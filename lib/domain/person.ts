export type PersonProfile = {
  id: string;
  name: string;
  education: string;
  experience: string;
  createdAt: string;
  updatedAt: string;
};

export function createPersonProfile(data?: Partial<PersonProfile>): PersonProfile {
  const now = new Date().toISOString();
  return {
    id: data?.id || `person_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data?.name ? data.name.trim() : "",
    education: data?.education ? data.education.trim() : "",
    experience: data?.experience ? data.experience.trim() : "",
    createdAt: data?.createdAt || now,
    updatedAt: data?.updatedAt || now,
  };
}

export function updatePersonProfile(current: PersonProfile, updates: Partial<PersonProfile>): PersonProfile {
  return {
    ...current,
    ...updates,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    education: updates.education !== undefined ? updates.education.trim() : current.education,
    experience: updates.experience !== undefined ? updates.experience.trim() : current.experience,
    updatedAt: new Date().toISOString(),
  };
}

export function getDisplayName(person: PersonProfile): string {
  const trimmed = person.name.trim();
  if (!trimmed) return "there";
  const first = trimmed.split(/\s+/)[0];
  return first || "there";
}
