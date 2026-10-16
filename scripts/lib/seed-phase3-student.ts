/**
 * Seeds a completed student on the LOCAL test database for Phase 3 browser
 * checks and prints {email, password, personId}. Pass "empty" for a student
 * with the bare minimum (empty-state checks).
 *
 *   node --import tsx scripts/lib/seed-phase3-student.ts [rich|empty]
 */
import { useTestDatabase } from "./test-db";

async function main() {
  const kind = process.argv[2] === "empty" ? "empty" : "rich";
  await useTestDatabase();
  const { createUser } = await import("../../lib/repositories/user-repository");
  const { hashPassword } = await import("../../lib/auth/password");
  const { completeOnboarding } = await import("../../lib/services/onboarding-v2-service");
  const password = "visual-check-pw";
  const email = `p3-${kind}-${Date.now()}@test.invalid`;
  const { personId } = await createUser({ email, passwordHash: await hashPassword(password), displayName: kind === "rich" ? "Kavya Raman" : "Arjun Mehta" });
  if (kind === "rich") {
    await completeOnboarding(personId, {
      role: "student", name: "Kavya Raman", targetRole: "Machine Learning Engineer", targetRoleId: "ml_engineer",
      institution: "IIT Madras", degree: "B.Tech", specialization: "Computer Science", year: "3rd year",
      priorities: ["projects", "learning", "jobs"], primaryPriority: "projects",
      skills: ["Python", "PyTorch", "Scikit-Learn", "SQL", "Docker", "Linear Algebra"],
      projects: [
        { id: "p1", title: "Crop Disease Detector", description: "CNN that classifies leaf images into 12 crop diseases; 94% validation accuracy on PlantVillage.", technologies: ["PyTorch", "Python", "Docker"], sources: ["github"], status: "confirmed", contribution: [], contributionNote: "Built the training loop, augmentation and the FastAPI inference service.", url: "https://github.com/kavya-r/crop-disease" },
        { id: "p2", title: "Lecture Notes Q&A", description: "Retrieval-augmented question answering over course notes.", technologies: ["Python", "FAISS", "Scikit-Learn"], sources: ["resume"], status: "confirmed", contribution: [], contributionNote: "" },
        { id: "p3", title: "Hostel Mess Demand Forecast", description: "Gradient-boosted model predicting daily meal counts.", technologies: ["Scikit-Learn", "SQL", "Python"], sources: ["resume", "github"], status: "confirmed", contribution: [], contributionNote: "Feature engineering and the evaluation report." },
      ],
      education: [{ institution: "IIT Madras", degree: "B.Tech", fieldOfStudy: "Computer Science", graduationYear: "2027", status: "confirmed", source: "resume" }],
      experiences: [{ company: "Sarvam Labs", role: "ML Intern", startDate: "May 2026", endDate: "Jul 2026", highlights: ["Evaluated tokenizers for Indic languages"], technologies: ["Python", "PyTorch"], status: "confirmed", source: "resume" }],
      achievements: [{ title: "Smart India Hackathon finalist", category: "hackathon", issuer: "Government of India", date: "2025", status: "confirmed", source: "resume" }],
      profiles: { github: "https://github.com/kavya-r" },
    });
  } else {
    await completeOnboarding(personId, {
      role: "student", name: "Arjun Mehta", targetRole: "Generative AI Engineer", targetRoleId: "genai_engineer",
      institution: "", degree: "", priorities: ["learning"], primaryPriority: "learning", skills: [], projects: [],
    });
  }
  console.log(JSON.stringify({ email, password, personId }));
  const { closeDbForTesting } = await import("../../lib/db");
  await closeDbForTesting();
}

main().catch((e) => { console.error(e); process.exit(1); });
