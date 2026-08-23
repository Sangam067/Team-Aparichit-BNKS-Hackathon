# Boss Battle Redirect Glitch Fix - Line by Line Changes

## File Updated

- app/battle/page.js

## Exact line-by-line edits

- Line 50: Added `const resetBattleState = useCallback(() => {`
- Line 51: Added `setBattle(null);`
- Line 52: Added `setTopic(null);`
- Line 53: Added `setCurrentQuestion(0);`
- Line 54: Added `setSelectedAnswer(null);`
- Line 55: Added `setSubmitted(false);`
- Line 56: Added `setLastAnswerCorrect(null);`
- Line 57: Added `setScore(0);`
- Line 58: Added `setBossHp(80);`
- Line 59: Added `setPlayerHp(50);`
- Line 60: Added `setWrongCount(0);`
- Line 61: Added `setSubmitting(false);`
- Line 62: Added `setShakeMonster(false);`
- Line 63: Added `setShakePlayer(false);`
- Line 64: Added `setDamagePopup(null);`
- Line 65: Added `setPlayerDamagePopup(null);`
- Line 66: Added `setError("");`
- Line 67: Added `}, []);`

- Line 86: Added `let isCancelled = false;` at start of battle-loading effect.
- Line 96: Added `resetBattleState();` before API fetch so switching topics starts a fresh battle session.
- Line 108: Added `if (isCancelled) return;` before `setBattle(...)` to prevent stale async state updates.
- Line 112: Added `if (isCancelled) return;` in `catch` to avoid stale error updates.
- Line 116: Added `if (isCancelled) return;` in `finally` to avoid stale loading updates.
- Line 123: Added cleanup return block start `return () => {`.
- Line 124: Added `isCancelled = true;` in cleanup.
- Line 125: Added cleanup block end `};`.
- Line 126: Updated effect dependency list from `[topicId]` to `[topicId, resetBattleState]`.

## Why this fixes the glitch

When navigating between bosses on the same route (`/battle`) with a different `topicId`, the page component instance can be reused. Previously, old state (question index, HP, animations, submit state) could leak into the next topic session. This patch forces a full battle-state reset on each `topicId` change and ignores stale async responses from previous topic loads.

---

## Update 2: Continue Learning opens Topic Study Session

### Files Updated

- app/battle/page.js
- app/learning/page.js

### Exact line-by-line edits

#### app/battle/page.js

- Line 224: Updated redirect logic from `router.push("/learning");` to `router.push(topicId ? `/learning?openTopicId=${topicId}` : "/learning");`.

#### app/learning/page.js

- Line 3: Added `useCallback` to React imports.
- Line 99: Added `const requestedOpenTopicId = searchParams.get("openTopicId");`.
- Line 113: Added `const [autoOpenResolved, setAutoOpenResolved] = useState(false);`.

- Line 185: Converted `openTopicStudy` into `useCallback(async (topic) => { ... }, []);` for stable effect dependency.

- Line 211: Added effect to reset auto-open state whenever `openTopicId` query changes.
- Line 215: Added auto-open effect that:
  - Validates `openTopicId`.
  - Finds the topic in current subject curriculum.
  - Opens the Study modal with `openTopicStudy(matchedTopic)`.
  - Cleans URL by removing `openTopicId` via `router.replace(...)`.
  - Resolves cross-subject topic IDs by calling `/api/topics/{topicId}` and switching `currentSubjectId` when needed.
  - Guards async updates with `isDisposed` cleanup.

- Line 269: Added effect dependency array entries for the new auto-open flow.

### Behavior after this update

- After finishing boss fight, clicking Continue Learning now routes to learning with `openTopicId`.
- Learning page opens the matching topic Study session modal automatically.
- If the topic belongs to another subject, the page switches to the correct subject first, then opens Study.
- URL is cleaned after auto-open to avoid reopening the modal unintentionally.

---

## Update 3: Keep Same Subject After Boss Defeat

### Files Updated

- app/api/topics/[topicId]/battle/route.js
- app/battle/page.js

### Exact line-by-line edits

#### app/api/topics/[topicId]/battle/route.js

- Line 26: Added `s.id AS subject_id` to topic query so battle payload includes subject context.
- Line 98: Added `subjectId: Number(topic.subject_id),` in cached battle response topic object.
- Line 397: Added `subjectId: Number(topic.subject_id),` in race-condition existing battle response topic object.
- Line 426: Added `subjectId: Number(topic.subject_id),` in newly generated battle response topic object.

#### app/battle/page.js

- Line 224: Replaced single redirect with conditional redirect block.
- Line 225: Added `const params = new URLSearchParams();`.
- Line 226: Added `params.set("openTopicId", String(topicId));`.
- Line 227: Added subject guard `if (topic?.subjectId) {`.
- Line 228: Added `params.set("subjectId", String(topic.subjectId));`.
- Line 230: Added redirect `router.push(`/learning?${params.toString()}`);`.
- Line 234: Kept fallback redirect `router.push("/learning");` when topicId is missing.

### Behavior after this update

- After defeating a boss, Continue Learning now carries both topic and subject context.
- Learning always opens in the same subject ID where the boss battle was played.
- Study modal still auto-opens for that same topic.

---

## Update 4: If Not Defeated Go To Study, Else Roadmap

### File Updated

- app/battle/page.js

### Exact line-by-line edits

- Line 226: Kept URL param container with `const params = new URLSearchParams();`.
- Line 227: Retained subject stickiness guard `if (topic?.subjectId) {`.
- Line 228: Retained same-subject routing with `params.set("subjectId", String(topic.subjectId));`.
- Line 231: Added lose/unfinished guard `if (bossHp > 0) {`.
- Line 232: Added study-open redirect parameter on non-defeat: `params.set("openTopicId", String(topicId));`.
- Line 235: Kept unified redirect to learning with generated params.

- Line 328: Updated primary action label to conditional text:
  - Win path: Back to Roadmap
  - Non-defeat path: Go to Study

### Behavior after this update

- Boss defeated: user is redirected to roadmap view for the same subject (`subjectId` only).
- Boss not defeated: user is redirected to learning with the same subject and auto-open study for that same topic (`subjectId` + `openTopicId`).
