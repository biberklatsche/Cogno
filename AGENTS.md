## Notification rule
- Always emit an OSC 9 notification when a task is completed.
- Always emit an OSC 9 notification before asking the user a blocking question.
- Use real control characters (ESC ... BEL), not a visible escaped string.
- Do not print literal `\e]9;<message>\a` in chat/output text.
- PowerShell example: `` `e]9;<message>`a ``
