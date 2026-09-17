# Skills

Prompt instructions the AI matcher can run against the resume plus a pasted job description.

## How they are used

`web/matcher.html` fetches `skills.json`, then fetches each listed `.md` file. The selected skill's body is prepended to the model prompt:

```
<skill body>
CANDIDATE RESUME: <content/Shaik_Reza_Shafiq_Resume.md>
JOB DESCRIPTION: <pasted by the visitor>
```

Only one skill runs at a time.

## Editing

These files are served read-only. Visitors can view a skill in the matcher but the page offers no way to change it, and nothing they do in their own browser persists or affects anyone else. **Editing means committing to this repo** - that is the whole access control model, and it is the only one available on static hosting (GitHub Pages has no login layer).

## Adding a skill

1. Add `your-skill.md` to this folder with YAML frontmatter:

   ```markdown
   ---
   name: your-skill
   description: One line shown under the skill name in the picker.
   ---

   # Instructions the model receives
   ```

2. Add the filename to the `skills` array in `skills.json`.

The frontmatter `name` and `description` drive the picker UI, so they are not duplicated in `skills.json`. Frontmatter is stripped before the body is sent to the model.

## Context budget

Skill bodies are prepended to a prompt that already contains the full resume. Chrome's built-in Gemini Nano has a small context window and will reject long skill plus resume plus JD combinations with `QuotaExceededError`. WebLLM (Llama-3-8B) has considerably more room. The matcher shows an estimated prompt size when a skill is selected.
