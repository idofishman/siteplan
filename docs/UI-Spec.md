# UI-Spec.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

All UI is RTL (right-to-left) Hebrew. Text alignment is right. Layout flows from right to left.

---

## 1. Global Layout

```
+----------------------------------------------------------+
|  HEADER (row 1: account switcher, save, user)            |
+----------------------------------------------------------+
|  PRESENCE BAR (row 2: online users)                      |
+----------------------------------------------------------+
|  NAV TABS + TOOLBAR                                      |
+----------------------------------------------------------+
|  MAIN CONTENT AREA                                       |
+----------------------------------------------------------+
```

---

## 2. Color System

### 2.1 App Shell
- Header background: #1E293B (dark slate)
- Header text: white
- Main content: white
- Border: #E2E8F0

### 2.2 Page Status Badge Colors

| Status | Background | Text |
|---|---|---|
| planned | #EFF6FF | #3B82F6 |
| existing | #F0FDF4 | #16A34A |
| in_progress | #FFF7ED | #EA580C |
| needs_review | #FEFCE8 | #CA8A04 |
| approved | #F0FDF4 | #15803D |
| deprecated | #F1F5F9 | #64748B |
| redirect | #FDF4FF | #9333EA |
| archived | #FFF1F2 | #E11D48 |

### 2.3 GSC Click Thresholds

| Clicks | Color |
|---|---|
| 0 / no match | No indicator |
| 1–49 | #94A3B8 gray |
| 50–199 | #22C55E green |
| 200–999 | #3B82F6 blue |
| 1000+ | #F59E0B gold |

### 2.4 Presence Colors

- Active (within 2 min): #22C55E (green dot)
- Inactive (2–10 min): #F59E0B (yellow dot)

### 2.5 Import Conflict Colors

| Conflict Status | Color |
|---|---|
| new | #22C55E green |
| existing_overwrite | #3B82F6 blue |
| existing_skip | #94A3B8 gray |
| duplicate | #F59E0B amber |
| invalid | #EF4444 red |

---

## 3. Screen: Login Page (/login)

```
+------------------------------------------+
|          מנהל מבנה האתר                  |
|                                          |
|  [  אימייל                           ]   |
|  [  סיסמה                            ]   |
|  [         התחבר          ]              |
|  [error message]                         |
+------------------------------------------+
```

- Email: `<input type="email" dir="ltr" />`
- Password: `<input type="password" />`
- Submit button: #1E293B bg, white text, full width
- Loading state: spinner + "מתחבר..." button disabled

---

## 4. Screen: Account Selector (/select-account)

```
+------------------------------------------+
|  Header (user pill + logout)             |
+------------------------------------------+
|  בחר חשבון לעבוד עליו                    |
|                                          |
|  +----------+  +----------+              |
|  | Colman   |  | White Web|              |
|  | colman.  |  | whiteweb.|              |
|  | 320 עמ'  |  | 85 עמ'   |              |
|  +----------+  +----------+              |
|                                          |
|  [+ צור חשבון חדש] (admin only)          |
+------------------------------------------+
```

- Account cards sorted: last used first, then alphabetical
- Last used account has subtle blue border or star indicator
- Card hover: elevation shadow
- System admin sees all accounts
- "Create Account" button: outline style, admin only

---

## 5. Header Component

```
+-------------------------------------------------------------------+
| [🏛] מנהל מבנה האתר  |  חשבון: [Colman ▼]  |  [שומר...]  [👤 ▼] |
+-------------------------------------------------------------------+
| 🟢 Dana  🟢 Yossi  🟡 Ran (לא פעיל 3 דקות)  +2 עוד             |
+-------------------------------------------------------------------+
```

**Row 1 — Main header (#1E293B):**
- App icon + title (right in RTL)
- Account Switcher dropdown (center) — hidden if only 1 account and not admin
- Save Indicator (left-center)
- User pill (leftmost): avatar initial, display name, dropdown ▼

**Row 2 — Presence bar (#1E3A5F):**
- Shows first 5 online users with colored dots
- If more than 5 online: "+N עוד" link → opens PresencePopover listing all online users
- Hidden when 0 or 1 user in account (only show when 2+)

### Account Switcher Dropdown

```
+---------------------------+
| ✓ Colman                  |
|   White Web Worx          |
|   Client A                |
| ─────────────────         |
| [+ צור חשבון] (admin)     |
+---------------------------+
```

### User Pill Dropdown

```
+---------------------------+
| dana@example.com          |
| ─────────────────         |
| התנתק                     |
+---------------------------+
```

### Save Indicator States

| State | Text | Color |
|---|---|---|
| idle | (empty) | — |
| saving | שומר... | #94A3B8 |
| saved | נשמר ✓ | #22C55E (fades 3s) |
| error | שגיאת שמירה ✗ | #EF4444 (stays) |

---

## 6. Navigation Tabs + Toolbar

```
+----------------------------------------------------------------------+
| [מפה] [פעילות] [צלמיות] [כתובות חסרות] | [ייצא JSON] [ייבא] [+ צלמית] |
+----------------------------------------------------------------------+
```

Active tab: bottom border in #3B82F6.
Toolbar buttons on the left (RTL).

---

## 7. Main Tab: Sitemap Tree View

### Tree Toolbar (above tree)

```
+------------------------------------------------------------------+
| [🔍 חיפוש...]  [סטטוס ▼]  [תבנית ▼]  [צבע ▼]  [+ עמוד שורש]   |
+------------------------------------------------------------------+
```

### Tree Header Row

```
+------------------------------------------------------------------+
| [☐ בחר הכל]                                    X עמודים נבחרו  |
+------------------------------------------------------------------+
```

### Tree Node Row (right-to-left)

```
| ▼ 🟩 דף הבית [קיים] [📝] [1,234]          [🤖 בקרוב] [⋮]  [☐] |
|   ▼ 🟦 מחלקות [קיים]                                   [⋮]  [☐] |
|     ► 🟨 מנהל עסקים [מתוכנן]                           [⋮]  [☐] |
```

From right to left:
1. Checkbox (on hover / when any selected)
2. Kebab menu ⋮ (on hover)
3. GSC click count badge (if url matches and clicks > 0)
4. Notes icon 📝 (if notes not empty) + hover tooltip
5. Status badge (colored pill)
6. Page name (bold)
7. Color swatch (small colored square)
8. Expand/collapse toggle (▼ or ►)

Indentation: 24px per level (padding-right in RTL).

### Kebab Menu Options

```
הוסף עמוד בן
ערוך
שנה סטטוס  →  [submenu: 8 statuses]
מחק
```

---

## 8. Bulk Toolbar

Appears fixed at bottom of viewport when 1+ pages selected:

```
+------------------------------------------------------------------+
| ✕ בטל  |  X עמודים נבחרו  | [מחק] [הזז] [סטטוס] [תבנית] [צבע] [הערה] |
+------------------------------------------------------------------+
```

- Background #1E293B, white text
- Disabled while save in progress
- X button clears selection

---

## 9. Modal: Add / Edit Page

```
+------------------------------------------+
| הוסף עמוד / ערוך עמוד          [✕]       |
+------------------------------------------+
| שם *                                     |
| [________________________________]        |
|                                          |
| כתובת URL                                |
| [________________________________] (ltr)  |
|                                          |
| סטטוס *   [קיים                 ▼]       |
|                                          |
| תבנית     [page                 ▼]       |
|                                          |
| צבע                                      |
| [● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●]      |
|                                          |
| הערות                                    |
| [________________________________]       |
| [________________________________]       |
|                                          |
| [ביטול]                    [שמור]        |
+------------------------------------------+
```

URL field: `dir="ltr"`. Color: 16 swatches in 4×4 grid, selected has ring. "שמור" = submit + immediate DB write.

---

## 10. Modal: Delete Confirm

```
+------------------------------------------+
| מחיקת עמוד                    [✕]        |
| האם למחוק "שם העמוד"?                    |
| ⚠️ עמוד זה מכיל 5 בנים שגם יימחקו.      |
|                                          |
| [ביטול]                    [מחק]         |
+------------------------------------------+
```

"מחק" button: #EF4444.

---

## 11. Modal: Bulk Delete Confirm

```
+------------------------------------------+
| מחיקה מרובה                              |
| ⚠️ X עמודים נבחרו.                        |
| סה"כ Y עמודים יימחקו (כולל עמודים בנים). |
|                                          |
| [ביטול]                    [מחק הכל]    |
+------------------------------------------+
```

Y = total of selected pages + all their descendants (calculated before showing modal).

---

## 12. Modal: Import — Step 1 (Upload + Settings)

```
+------------------------------------------+
| ייבוא נתוני מפה                [✕]       |
+------------------------------------------+
| קובץ (xlsx / csv / json)                 |
| [גרור לכאן או לחץ לבחירה]                |
| מקסימום 10MB | עד 20,000 שורות           |
|                                          |
| הוראות לניתוח (אופציונלי)                |
| [________________________________]       |
| [________________________________]       |
| לדוגמה: "עמודה A = URL, B = שם,          |
|  C = מחלקה. צור עמודי hub לקטגוריות"    |
|                                          |
| מצב ייבוא                                |
| ○ ניתוח בלבד (ללא שינויים)              |
| ○ מיזוג לתוך המפה הקיימת               |
| ○ יצירת מפה חדשה (מחליף הכל)            |
|                                          |
| טיפול בקונפליקטים (אם מיזוג נבחר)       |
| ○ הוסף כתובות חדשות בלבד               |
| ○ דרוס כתובות קיימות                    |
|                                          |
| [ביטול]                    [נתח ←]       |
+------------------------------------------+
```

Conflict behavior selector: visible only when "מיזוג לתוך המפה הקיימת" is selected.
"נתח" button: disabled until a file is selected.
File size and row limit text ("מקסימום 10MB | עד 20,000 שורות") is always visible under the file drop zone.

**Validation error display:** If the uploaded file exceeds any limit, show an inline error below the drop zone in red, e.g.:
- "הקובץ גדול מדי — מקסימום 10MB"
- "הקובץ מכיל יותר מדי שורות — מקסימום 20,000"
The "נתח" button remains disabled. The user must select a different file.

---

## 13. Modal: Import — Step 2 (Preview)

```
+------------------------------------------------------+
| תצוגה מקדימה של ייבוא               [✕]             |
+------------------------------------------------------+
| ✅ 45 עמודים חדשים  🔵 12 יידרסו  ⚪ 8 ידולגו        |
| ⚠️ 2 כפולים  ❌ 1 שגוי                              |
+------------------------------------------------------+
| הנחות המנוע:                                         |
| • עמודה B זוהתה כשם העמוד                           |
| • עמודה D זוהתה כקטגוריה (יוצרת hub pages)         |
| • 5 עמודי hub הוצעו אוטומטית                        |
+------------------------------------------------------+
| [📋 עמודים חדשים (45)]                 [펼치기]       |
|  🟢 /biotechnology/ — ביוטכנולוגיה     [confidence: 0.95] |
|  🟢 /management/ — ניהול עסקים          |
|  ...                                                 |
|                                                      |
| [📋 יידרסו (12)]                       [펼치기]       |
|  🔵 /admissions/ — שם ישתנה מ"הרשמה" ל"קבלה"      |
|  ...                                                 |
|                                                      |
| [📋 שגויים ומוצאים (3)]               [펼치기]       |
|  ❌ שורה 14: URL לא תקין "/bad url"                  |
|  ⚠️ שורה 22: כפול /about/                           |
+------------------------------------------------------+
| [← חזרה]  [ביטול ייבוא]         [החל ייבוא →]       |
+------------------------------------------------------+
```

- "החל ייבוא" triggers the transactional apply
- Low-confidence items have a 💡 icon; clicking shows engine reasoning

---

## 14. Modal: Snapshot Name

```
+------------------------------------------+
| צור צלמית חדשה                [✕]        |
| שם הצלמית:                               |
| [________________________________]        |
| לדוגמה: לפני מיגרציה, לאנץ׳ יוני 2026   |
|                                          |
| [ביטול]                    [צור]         |
+------------------------------------------+
```

---

## 15. Tab: Snapshots (/app/snapshots)

```
+------------------------------------------------------------------+
| צלמיות                                    [+ צור צלמית]         |
+------------------------------------------------------------------+
| שם              | יוצר  | תאריך      | עמודים | פעולות           |
| לפני מיגרציה   | Dana  | 15/06/2026 | 320   | [שחזר][השווה][ייצא][מחק] |
| לאנץ׳ יוני     | Yossi | 01/06/2026 | 305   | [שחזר][השווה][ייצא][מחק] |
+------------------------------------------------------------------+
```

Auto-generated snapshots (from restore/clear/import) are visually marked with a 🔒 icon and cannot be deleted by users (only by admin).

---

## 16. Modal: Snapshot Compare

Full-width modal, two columns:

```
+----------------------------------+----------------------------------+
| בצלמית (15/06/2026)             | כיום                            |
+----------------------------------+----------------------------------+
| 🟢 דף הבית                      | 🟢 דף הבית                      |
| 🔴   ביוטכנולוגיה (נמחק)        |                                 |
|                                  | 🟡   ניהול ידע (נוסף)          |
| 🔵   חינוך (שם שונה)            | 🔵   מחלקת החינוך              |
+----------------------------------+----------------------------------+
| 🟢 ללא שינוי  🔴 נמחק  🟡 נוסף  🔵 שונה                         |
+----------------------------------+----------------------------------+
```

---

## 17. Tab: Activity Feed (/app/activity)

```
+------------------------------------------------------------------+
| פעילות    [משתמש ▼] [תאריך ▼] [פעולה ▼]                         |
+------------------------------------------------------------------+
| 👤D  Dana יצרה עמוד "ביוטכנולוגיה"                  לפני 5 דק  |
| 👤Y  Yossi ייבא 45 עמודים חדשים (קובץ: pages.xlsx)  לפני 12 דק |
| 👤A  Admin ביצעה ניתוח קובץ sitemap.csv              לפני שעה  |
| 👤A  Admin מחקה מפת האתר (320 עמודים — גיבוי נשמר)  אמש        |
+------------------------------------------------------------------+
| [טען עוד 50 רשומות]                                              |
+------------------------------------------------------------------+
```

---

## 18. Tab: Missing URLs (/app/missing-urls)

```
+------------------------------------------------------------------+
| כתובות ב-GSC ללא עמוד במפה                                       |
+------------------------------------------------------------------+
| [☐] כתובת                       | לחיצות | פעולה                |
| [☐] /faculty/biotechnology/     | 1,245  | [+ הוסף עמוד]        |
| [☐] /research/climate/          | 892    | [+ הוסף עמוד]        |
+------------------------------------------------------------------+
| [+ הוסף עמודים נבחרים (X)]                                       |
+------------------------------------------------------------------+
```

Sorted by clicks DESC. Checkboxes enable bulk add (batch create pages with default fields).

---

## 19. Admin: Account List (/admin/accounts)

```
+------------------------------------------------------------------+
| ניהול חשבונות                            [+ חשבון חדש]          |
+------------------------------------------------------------------+
| שם        | דומיין        | עמודים | משתמשים | סטטוס            |
| Colman    | colman.ac.il  | 320    | 3       | פעיל      [⋮]   |
| Old Client| old.com       | 150    | 0       | ארכיון    [⋮]   |
+------------------------------------------------------------------+
```

---

## 20. Admin: Account Detail (/admin/accounts/:id)

Shows account info, assigned users section, and Danger Zone at the bottom.

**Section 1: Account Info**
- Name, slug, domain (editable), created date, is_active toggle

**Section 2: Assigned Users**
```
+--------------------------------+
| משתמשים מוקצים      [+ הוסף]  |
| Dana Cohen   dana@...  [הסר]  |
| Yossi Levi   yossi@... [הסר]  |
+--------------------------------+
```

**Section 3: Danger Zone**

Visually separated with a red border at the bottom of the page:

```
+------------------------------------------------------------------+
| ⚠️ Danger Zone                                                    |
+------------------------------------------------------------------+
| מחיקת מפת האתר                                                    |
| מוחק את כל עמודי המפה עבור חשבון זה.                             |
| לא מוחק: חשבון, משתמשים, GSC, פעילות, צלמיות.                   |
|                                              [מחק מפה]           |
+------------------------------------------------------------------+
```

"מחק מפה" button: red (#EF4444), visible to system_admin only.

---

## 21. Modal: Clear Sitemap — First Confirmation

```
+------------------------------------------+
| ⚠️ אזהרה                       [✕]       |
+------------------------------------------+
| פעולה זו תמחק את כל מפת האתר של          |
| החשבון הנוכחי.                           |
| הפעולה אינה מוחקת את החשבון,             |
| משתמשים, נתוני GSC או צלמיות.            |
|                                          |
| [ביטול]                  [המשך →]        |
+------------------------------------------+
```

---

## 22. Modal: Clear Sitemap — Second Confirmation

```
+------------------------------------------+
| ⛔ אישור סופי                   [✕]       |
+------------------------------------------+
| ⚠️ לא ניתן לבטל פעולה זו.                |
| צלמית גיבוי אוטומטית תיווצר לפני המחיקה.|
|                                          |
| להמשך, הקלד את שם החשבון:               |
| Colman                                   |
| [________________________________]        |
|                                          |
| [ביטול]            [מחק מפה] (disabled)  |
+------------------------------------------+
```

"מחק מפה" enables only when typed value matches account name (case-insensitive).

---

## 23. Admin: User List (/admin/users)

```
+------------------------------------------------------------------+
| ניהול משתמשים                                                    |
| שם           | אימייל             | תפקיד   | חשבונות           |
| Dana Cohen   | dana@...           | משתמש  | Colman, WW        |
| Ido Fishman  | ido@whiteweb.co.il | מנהל   | הכל               |
+------------------------------------------------------------------+
```

Role column: click to toggle (with confirm dialog).

---

## 24. Admin: GSC Upload (/admin/gsc)

```
+------------------------------------------+
| העלאת נתוני GSC                          |
| חשבון: [Colman                    ▼]     |
| [גרור CSV לכאן / לחץ לבחירה]            |
|                                          |
| תצוגה מקדימה (10 שורות):                 |
| URL                    | לחיצות         |
| /                      | 12,450         |
|                                          |
| [ביטול]            [העלה ואשר]           |
+------------------------------------------+
```

---

## 25. Presence Popover ("+N עוד")

Opens when user clicks "+N עוד" in presence bar:

```
+---------------------+
| מי מחובר עכשיו?     |
| 🟢 Dana              |
| 🟢 Yossi             |
| 🟢 Ran               |
| 🟡 Michal (5 דק)     |
| 🟡 Gal (8 דק)        |
| 🟢 Noa               |
| 🟢 Uri               |
+---------------------+
```

Closes on click outside.

---

## 26. Empty States

| Screen | Message |
|---|---|
| Tree (no pages) | "אין עמודים עדיין. לחץ 'הוסף עמוד שורש' להתחיל." |
| Snapshots | "אין צלמיות. לחץ 'צור צלמית' לשמירת מצב נוכחי." |
| Activity | "אין פעילות לתצוגה." |
| Missing URLs | "כל הכתובות ב-GSC ממופות לעמודים. כל הכבוד!" |
| Account Selector (0 accounts) | "לא הוקצו לך חשבונות. פנה למנהל המערכת." |

---

## 27. Loading States

- Tree loading: skeleton rows (gray rectangles, 3 levels deep)
- Modal opening: blur overlay + spinner
- Button action in progress: spinner replaces text, button disabled
- Tab loading: centered spinner

---

## 28. Toast Notifications

Non-blocking, top-center, auto-dismiss after 3 seconds (errors stay until dismissed):

- Snapshot created: "הצלמית נוצרה בהצלחה"
- Snapshot restored: "הצלמית שוחזרה בהצלחה"
- Import applied: "X עמודים נוצרו, Y עודכנו, Z דולגו"
- GSC uploaded: "X כתובות נטענו"
- Sitemap cleared: "מפת האתר נמחקה. צלמית גיבוי נוצרה."
- Error: red background, stays until clicked

---

## 29. Accessibility

- All modals trap focus, support Escape to close
- Form fields have `<label>` elements
- Status badges: `aria-label` with full status name
- Color swatches: `aria-label` with hex and color name
- Tree keyboard: Arrow keys to traverse, Enter to edit, Delete to confirm-delete
- Danger Zone buttons: `aria-describedby` pointing to warning text
