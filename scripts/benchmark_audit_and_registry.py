#!/usr/bin/env python3
"""
AI TATHASTU — V5.0.1 BENCHMARK REGISTRY & DATASET AUDIT GENERATOR
Deterministic, privacy-safe inventory and frozen evaluation split creation.
Strictly zero personal identifiable information (PII) recorded in outputs.
"""

import os
import sys
import re
import csv
import json
import zlib
import hashlib
from collections import defaultdict, Counter

SEED = "AITATHASTU_V5_0_1_FROZEN_BENCHMARK_SEED_42"

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def get_page_count(data: bytes) -> int:
    pages = len(re.findall(rb'/Type\s*/Page\b', data))
    if pages == 0:
        m = re.search(rb'/Type\s*/Pages\b.*?/Count\s+(\d+)', data, re.DOTALL)
        pages = int(m.group(1)) if m else 1
    return max(1, pages)

def inspect_pdf_text_and_images(data: bytes):
    """
    Checks for native text streams and extracts embedded image hashes.
    """
    has_text = False
    text_chars_approx = 0
    image_hashes = []
    
    stream_matches = re.finditer(rb'stream[\r\n]+(.*?)[\r\n]+endstream', data, re.DOTALL)
    for sm in stream_matches:
        raw_stream = sm.group(1)
        decomp = None
        try:
            decomp = zlib.decompress(raw_stream)
        except Exception:
            try:
                decomp = zlib.decompress(raw_stream, -zlib.MAX_WBITS)
            except Exception:
                decomp = raw_stream
        
        # Check text
        if decomp and b'BT' in decomp and (b'Tj' in decomp or b'TJ' in decomp):
            has_text = True
            matches = re.findall(rb'\((.*?)\)\s*Tj', decomp)
            for m in matches:
                text_chars_approx += len(m)
            tj_matches = re.findall(rb'\[(.*?)\]\s*TJ', decomp)
            for m in tj_matches:
                text_chars_approx += len(m)
        
        # Check image stream
        if len(raw_stream) > 5000:
            image_hashes.append(compute_sha256(raw_stream))
            
    return has_text, text_chars_approx, image_hashes

def main():
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(workspace_root)
    print(f"[V5.0.1 Audit] Working directory: {workspace_root}")

    dataset_a_dir = os.path.join(workspace_root, "resume 2")
    dataset_b_dir = os.path.join(workspace_root, "Resumes PDF")
    benchmarks_dir = os.path.join(workspace_root, "benchmarks")
    splits_dir = os.path.join(benchmarks_dir, "splits")
    os.makedirs(splits_dir, exist_ok=True)

    # 1. Audit Dataset A CSV
    csv_path = os.path.join(dataset_a_dir, "Resume", "Resume.csv")
    csv_records = {}
    csv_categories = Counter()
    norm_text_to_ids = defaultdict(list)

    if os.path.exists(csv_path):
        with open(csv_path, mode="r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rid = row["ID"]
                cat = row["Category"]
                raw_str = row["Resume_str"]
                csv_records[rid] = {
                    "id": rid,
                    "category": cat,
                    "str_len": len(raw_str),
                    "is_empty": len(raw_str.strip()) == 0
                }
                csv_categories[cat] += 1
                norm_str = " ".join(raw_str.lower().split())
                norm_hash = compute_sha256(norm_str.encode("utf-8"))
                norm_text_to_ids[norm_hash].append(rid)

    # Duplicate clusters in Dataset A based on normalized text
    a_dup_clusters = {}
    a_dup_group_map = {}
    cluster_idx_a = 1
    for nhash, ids in norm_text_to_ids.items():
        if len(ids) > 1:
            grp_name = f"A_DUP_{cluster_idx_a:03d}"
            a_dup_clusters[grp_name] = ids
            for item_id in ids:
                a_dup_group_map[item_id] = grp_name
            cluster_idx_a += 1

    print(f"[Dataset A] CSV records: {len(csv_records)}, Categories: {len(csv_categories)}")
    print(f"[Dataset A] Text duplicate clusters: {len(a_dup_clusters)} ({sum(len(v) for v in a_dup_clusters.values())} files)")

    # 2. Inventory Dataset A PDFs
    dataset_a_docs = []
    a_pdf_root = os.path.join(dataset_a_dir, "data", "data")
    for root, dirs, files in os.walk(a_pdf_root):
        cat = os.path.basename(root)
        for f in sorted(files):
            if not f.endswith(".pdf"):
                continue
            doc_raw_id = f[:-4]
            fp = os.path.join(root, f)
            rel_path = os.path.relpath(fp, workspace_root)
            with open(fp, "rb") as fh:
                data = fh.read()
            sz = len(data)
            fp_hash = compute_sha256(data)
            pages = get_page_count(data)
            
            # Check eligibility and text
            csv_meta = csv_records.get(doc_raw_id, {})
            is_empty_stub = (doc_raw_id == "12632728") or (csv_meta.get("is_empty", False) and sz < 2000)
            
            has_native_text = not is_empty_stub
            ocr_candidate = False
            eligibility = "ineligible_empty_stub" if is_empty_stub else "eligible_native_text"
            
            dup_grp = a_dup_group_map.get(doc_raw_id, f"A_UNIQ_{doc_raw_id}")
            is_dup = doc_raw_id in a_dup_group_map

            dataset_a_docs.append({
                "doc_id": f"DOC-A-{doc_raw_id}",
                "raw_id": doc_raw_id,
                "dataset_source": "kaggle_snehaanbhawal_resume_dataset",
                "relative_path": rel_path,
                "category": cat,
                "format": "pdf",
                "file_size_bytes": sz,
                "page_count": pages,
                "content_fingerprint": fp_hash,
                "native_text_available": has_native_text,
                "ocr_required_candidate": ocr_candidate,
                "duplicate_group": dup_grp,
                "is_duplicate": is_dup,
                "processing_eligibility": eligibility,
            })

    print(f"[Dataset A] Total PDFs inventoried: {len(dataset_a_docs)}")

    # 3. Inventory Dataset B PDFs & detect duplicate images
    print("[Dataset B] Scanning PDFs and hashing raster images...")
    b_image_to_files = defaultdict(list)
    raw_b_files = []

    for root, dirs, files in os.walk(dataset_b_dir):
        cat = os.path.basename(root)
        for f in sorted(files):
            if not f.endswith(".pdf"):
                continue
            fp = os.path.join(root, f)
            rel_path = os.path.relpath(fp, workspace_root)
            with open(fp, "rb") as fh:
                data = fh.read()
            sz = len(data)
            fp_hash = compute_sha256(data)
            pages = get_page_count(data)
            has_text, text_chars, img_hashes = inspect_pdf_text_and_images(data)
            
            primary_img_hash = img_hashes[0] if img_hashes else fp_hash
            raw_b_files.append({
                "fp": fp,
                "rel_path": rel_path,
                "category": cat,
                "file_name": f,
                "sz": sz,
                "fp_hash": fp_hash,
                "pages": pages,
                "primary_img_hash": primary_img_hash,
            })
            b_image_to_files[primary_img_hash].append(rel_path)

    # Determine duplicate clusters in B
    b_dup_clusters = {}
    b_dup_group_map = {}
    cluster_idx_b = 1
    for imghash, rpaths in b_image_to_files.items():
        if len(rpaths) > 1:
            grp_name = f"B_IMG_DUP_{cluster_idx_b:04d}"
            b_dup_clusters[grp_name] = rpaths
            for rp in rpaths:
                b_dup_group_map[rp] = grp_name
            cluster_idx_b += 1

    print(f"[Dataset B] Total PDFs: {len(raw_b_files)}, Image duplicate clusters: {len(b_dup_clusters)} ({sum(len(v) for v in b_dup_clusters.values())} files)")

    dataset_b_docs = []
    for idx, item in enumerate(sorted(raw_b_files, key=lambda x: x["rel_path"])):
        doc_id = f"DOC-B-{idx+1:05d}"
        rel_path = item["rel_path"]
        dup_grp = b_dup_group_map.get(rel_path, f"B_UNIQ_{idx+1:05d}")
        is_dup = rel_path in b_dup_group_map
        
        dataset_b_docs.append({
            "doc_id": doc_id,
            "raw_id": item["file_name"],
            "dataset_source": "kaggle_hadikp_resume_data_pdf",
            "relative_path": rel_path,
            "category": item["category"],
            "format": "pdf",
            "file_size_bytes": item["sz"],
            "page_count": item["pages"],
            "content_fingerprint": item["fp_hash"],
            "native_text_available": False,
            "ocr_required_candidate": True,
            "duplicate_group": dup_grp,
            "is_duplicate": is_dup,
            "processing_eligibility": "eligible_ocr_required",
        })

    print(f"[Dataset B] Total PDFs inventoried: {len(dataset_b_docs)}")

    # 4. Stratified Split Allocation
    # Algorithm:
    # We group docs into duplicate clusters. Each cluster is assigned atomically to dev, val, or test_frozen.
    # We stratify by (dataset_source, category).
    print("[Splits] Performing stratified, duplicate-isolated split assignment...")
    
    def allocate_dataset_clusters(docs, source_tag):
        # 1. Map each duplicate cluster to all its member documents
        cluster_to_docs = defaultdict(list)
        for d in docs:
            cluster_to_docs[d["duplicate_group"]].append(d)
            
        # 2. Determine primary category for each cluster (first alphabetically among member docs)
        cat_to_clusters = defaultdict(list)
        for cid, doc_list in cluster_to_docs.items():
            cats = sorted(set(d["category"] for d in doc_list))
            prim_cat = cats[0]
            cat_to_clusters[prim_cat].append(cid)
            
        # 3. For each stratum/category, deterministically allocate clusters to dev, val, test_frozen
        cluster_split = {}
        for cat, cids in cat_to_clusters.items():
            sorted_cids = sorted(cids, key=lambda c: hashlib.sha256(f"{SEED}:{source_tag}:{cat}:{c}".encode()).hexdigest())
            N = len(sorted_cids)
            n_val = round(N * 0.15)
            n_test = round(N * 0.15)
            n_dev = N - n_val - n_test
            for i, c in enumerate(sorted_cids):
                if i < n_dev:
                    cluster_split[c] = "dev"
                elif i < n_dev + n_val:
                    cluster_split[c] = "val"
                else:
                    cluster_split[c] = "test_frozen"
                    
        # 4. Assign the cluster's split to every document in that cluster
        for d in docs:
            d["benchmark_split"] = cluster_split[d["duplicate_group"]]

    # Run for Dataset A and Dataset B
    allocate_dataset_clusters(dataset_a_docs, "A")
    allocate_dataset_clusters(dataset_b_docs, "B")

    all_docs = dataset_a_docs + dataset_b_docs

    # 5. Verify Zero Leakage
    cluster_to_splits = defaultdict(set)
    for d in all_docs:
        cluster_to_splits[d["duplicate_group"]].add(d["benchmark_split"])

    leaked_clusters = {cid: splits for cid, splits in cluster_to_splits.items() if len(splits) > 1}
    if leaked_clusters:
        print(f"CRITICAL ERROR: Data leakage detected across {len(leaked_clusters)} clusters!")
        sys.exit(1)
    else:
        print("[Splits Verification] PASS: Zero duplicate leakage! 100% of duplicate clusters reside in a single split.")

    # 6. Aggregate Metrics
    splits_summary = Counter()
    source_split_summary = defaultdict(Counter)
    format_summary = Counter()
    eligibility_summary = Counter()
    page_count_dist_a = Counter()
    page_count_dist_b = Counter()
    total_bytes_a = sum(d["file_size_bytes"] for d in dataset_a_docs)
    total_bytes_b = sum(d["file_size_bytes"] for d in dataset_b_docs)

    for d in all_docs:
        s = d["benchmark_split"]
        src = d["dataset_source"]
        splits_summary[s] += 1
        source_split_summary[src][s] += 1
        format_summary[d["format"]] += 1
        eligibility_summary[d["processing_eligibility"]] += 1
        if src == "kaggle_snehaanbhawal_resume_dataset":
            page_count_dist_a[d["page_count"]] += 1
        else:
            page_count_dist_b[d["page_count"]] += 1

    # Remove temporary raw_id field before saving
    for d in all_docs:
        d.pop("raw_id", None)

    # 7. Write Manifest and Split Files
    manifest_file = os.path.join(benchmarks_dir, "manifest.json")
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(all_docs, f, indent=2)
    print(f"[Manifest] Wrote {len(all_docs)} entries to {manifest_file}")

    dev_ids = [d["doc_id"] for d in all_docs if d["benchmark_split"] == "dev"]
    val_ids = [d["doc_id"] for d in all_docs if d["benchmark_split"] == "val"]
    test_ids = [d["doc_id"] for d in all_docs if d["benchmark_split"] == "test_frozen"]

    with open(os.path.join(splits_dir, "dev.json"), "w", encoding="utf-8") as f:
        json.dump(dev_ids, f, indent=2)
    with open(os.path.join(splits_dir, "val.json"), "w", encoding="utf-8") as f:
        json.dump(val_ids, f, indent=2)
    with open(os.path.join(splits_dir, "test_frozen.json"), "w", encoding="utf-8") as f:
        json.dump(test_ids, f, indent=2)

    summary_data = {
        "benchmark_version": "5.0.1",
        "seed": SEED,
        "total_documents": len(all_docs),
        "total_csv_records": len(csv_records),
        "dataset_a": {
            "source": "kaggle_snehaanbhawal_resume_dataset",
            "directory": "resume 2",
            "pdf_count": len(dataset_a_docs),
            "csv_count": 1,
            "csv_rows": len(csv_records),
            "total_bytes_pdf": total_bytes_a,
            "total_bytes_csv": os.path.getsize(csv_path) if os.path.exists(csv_path) else 0,
            "categories_count": len(set(d["category"] for d in dataset_a_docs)),
            "page_distribution": dict(sorted(page_count_dist_a.items())),
            "native_text_available_count": sum(1 for d in dataset_a_docs if d["native_text_available"]),
            "ocr_candidate_count": sum(1 for d in dataset_a_docs if d["ocr_required_candidate"]),
            "malformed_empty_stubs": sum(1 for d in dataset_a_docs if d["processing_eligibility"] == "ineligible_empty_stub"),
            "duplicate_clusters": len(a_dup_clusters),
            "duplicate_files_count": sum(len(v) for v in a_dup_clusters.values()),
            "usable_distinct_documents": len(dataset_a_docs) - 1 - (sum(len(v) for v in a_dup_clusters.values()) - len(a_dup_clusters)),
            "splits": dict(source_split_summary["kaggle_snehaanbhawal_resume_dataset"])
        },
        "dataset_b": {
            "source": "kaggle_hadikp_resume_data_pdf",
            "directory": "Resumes PDF",
            "pdf_count": len(dataset_b_docs),
            "csv_count": 0,
            "total_bytes_pdf": total_bytes_b,
            "categories_count": len(set(d["category"] for d in dataset_b_docs)),
            "page_distribution": dict(sorted(page_count_dist_b.items())),
            "native_text_available_count": sum(1 for d in dataset_b_docs if d["native_text_available"]),
            "ocr_candidate_count": sum(1 for d in dataset_b_docs if d["ocr_required_candidate"]),
            "malformed_empty_stubs": 0,
            "duplicate_image_clusters": len(b_dup_clusters),
            "duplicate_image_files_count": sum(len(v) for v in b_dup_clusters.values()),
            "usable_distinct_documents": len(dataset_b_docs) - (sum(len(v) for v in b_dup_clusters.values()) - len(b_dup_clusters)),
            "splits": dict(source_split_summary["kaggle_hadikp_resume_data_pdf"])
        },
        "splits_overall": {
            "dev_count": len(dev_ids),
            "val_count": len(val_ids),
            "test_frozen_count": len(test_ids),
            "dev_pct": round(len(dev_ids) / len(all_docs) * 100, 2),
            "val_pct": round(len(val_ids) / len(all_docs) * 100, 2),
            "test_frozen_pct": round(len(test_ids) / len(all_docs) * 100, 2)
        },
        "eligibility_overall": dict(eligibility_summary),
        "zero_leakage_verified": True
    }

    summary_file = os.path.join(benchmarks_dir, "manifest_summary.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    print(f"[Summary] Wrote metrics to {summary_file}")
    print("[Complete] V5.0.1 registry and splits generated successfully.")

if __name__ == "__main__":
    main()
