# Role and widget permissions

| Surface | Student | Faculty request pending | Authorized faculty |
|---|---|---|---|
| Own purpose and layout preferences | Yes | Yes | Yes |
| Own student evidence dashboard | Yes | Separate faculty shell | Separate faculty shell |
| Faculty overview and purpose cards | No | Saved choices and empty states | Yes |
| Student verification queue | No | No | `student.verify_skill` required |
| Verification decisions | No | No | Existing API capability and scope checks |
| Other students' data | No | No | Only through separately authorized workflows |

The Faculty card and `requestedRole` are never permission sources. Existing organization membership, role, and capability tables remain authoritative.
