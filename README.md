# AI-DLC UI-first workshop project

This IDE already has everything installed: Kiro CLI with a Kiro licence (no login needed), AI-DLC 2.11.2 with the UI-first add-on, Canvas and the module catalog. Claude Code on Amazon Bedrock is installed as Plan B. You only need this browser tab.

Three places, do not mix them up:

* **TERMINAL**: the terminal panel of this IDE. You type `ws` commands here.
* **INSIDE KIRO**: the chat that opens after you run `ws start`. Lines that start with `/aidlc` go only here.
* **CANVAS**: the browser tab where you answer questions and look at the UI.

## Steps

1. **TERMINAL.** A terminal usually opens by itself in `/workshop/spudtrack`. If it did not, open one: menu **Terminal > New Terminal**.

2. **TERMINAL.** Print the Canvas address:

   ```
   ws canvas url
   ```

   Open the address in a **new tab of this same browser**. Keep the slash at the end.

3. **CANVAS (browser tab).** Click the card of your app, or **Your own idea** and write it in your own words, as long as you want (at least 20 characters). Canvas saves it exactly as written in `briefs/idea.md`. Then answer the three quick questions. Canvas saves your choice. The brief of each app is in `briefs/` (`spudtrack.md`, `ev-fleet.md` or `stagehand.md`). For your own idea there is no brief yet: the AI reads `briefs/idea.md` and writes `briefs/custom.md` first.

4. **TERMINAL.** Start Kiro. The command waits for your app and your three answers, runs the environment check for you, says which app you chose and waits for Enter:

   ```
   ws start
   ```

   Wait for `RESULT: PASS step 0`. To check the environment earlier, run `ws verify 0` (optional).

5. **INSIDE KIRO.** Kiro opens with the first line already typed. Press Enter. Plan B: if the input is empty, paste the line that `ws start` printed.

6. **CANVAS (browser tab).** Wait for "Your first UI is ready (v1)". Review the assumptions. Answer the pins of the rounds. The AI asks its questions in Canvas, never in the chat.

7. **INSIDE KIRO.** When Canvas says all questions are answered, type `done`. If the AI asks in plain text whether it all looks correct, answer yes. Then choose **Approve** in the dialog. Repeat for each stage: answer in Canvas, then `done` and **Approve** in the chat.

8. **TERMINAL (a second terminal).** After each step, check it. Use the number of the step you just finished:

   ```
   ws verify 1
   ```

   If it says FAIL, read the FAIL line. It says what to do.

9. **TERMINAL.** If a step is stuck, ask your facilitator. If they agree, restore a known-good state for that step:

   ```
   ws fallback 1
   ```

If a Kiro line says FAIL, tell your facilitator and use Plan B (below) meanwhile.

From the scope board on (scope, refine, freeze, module, clean-up) follow the workshop pages.

Your app: one of the three briefs in `briefs/`, or your own idea. `briefs/apps.json` holds the cards Canvas shows. The reference prototype `reference/spudtrack-demo.html` is the demo this workshop grew from. The AI builds your UI from the brief, not from it.

## Plan B: Claude Code

Same steps, but with Claude Code on Amazon Bedrock (it uses the instance role). In step 4, run this in the **TERMINAL** instead of `ws start`:

```
ws start --agent claude
```

Or type `claude` in the terminal and paste the line that `ws start --print` shows **INSIDE CLAUDE CODE**. Lines that start with `/aidlc`, `done` and the approvals go there then.
