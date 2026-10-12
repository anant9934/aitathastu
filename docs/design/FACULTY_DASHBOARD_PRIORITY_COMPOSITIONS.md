# Faculty dashboard priority compositions

Faculty has its own workspace shell at `/faculty`. Ranking uses six distinct categories: teaching, assessments, mentorship, research, projects, and meetings. The primary category determines the hero and largest first card; secondary and tertiary follow at lower prominence.

Assessment cards show a real verifier queue count only after `student.verify_skill` is granted through an active organization membership. Pending requesters see the saved purpose and approval state but no queue or student data. Other faculty categories show truthful availability states until an institutional source or workflow is connected. This avoids implying that teaching, research, mentorship or meeting integrations exist today.

An authorized faculty member can open `/faculty/verification`. That route and its APIs retain their independent authorization checks.
