# very-own-skills

Personal Claude Code skill pack.

## Install

```
/plugin marketplace add jtuzar/very-own-skills
```

## Test locally

```bash
claude --plugin-dir /path/to/very-own-skills
```

Reload after changes with `/reload-plugins`.

## Adding a new skill

1. Copy `skills/example/` to `skills/your-skill-name/`
2. Edit `SKILL.md` — update the frontmatter and prompt body
3. Key frontmatter fields:
   - `name` — skill name
   - `description` — when/how Claude should invoke it (max 250 chars)
   - `user-invocable: true` — user can call it with `/very-own-skills:skill-name`
   - `disable-model-invocation: true` — only the user can trigger it (not Claude automatically)
   - `allowed-tools` — restrict which tools the skill can use
   - `argument-hint` — autocomplete hint shown to users
