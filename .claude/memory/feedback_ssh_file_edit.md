---
name: feedback-ssh-file-edit
description: "Как правильно редактировать файлы на сервере по SSH — только через scp, не через inline команды"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Никогда не редактировать файлы на сервере через `ssh ... "node -e \"...\""`  или `ssh ... python3 -c "..."` — backtick-строки в JavaScript и SQL-запросы ломают shell-экранирование и команда не выполняется.

**Why:** Файлы на сервере содержат template literals (обратные кавычки) и `${...}` — они интерпретируются bash'ем как command substitution и всё ломается. Это происходило несколько раз подряд.

**How to apply:** Единственный рабочий метод для правки серверных файлов:
1. Скачать файл: `ssh -i /tmp/haba_deploy root@147.45.134.216 "cat /path/to/file.js" > C:/tmp/file.js`
2. Отредактировать локально инструментом Edit
3. Загрузить обратно: `scp -i /tmp/haba_deploy "C:/tmp/file.js" root@147.45.134.216:/path/to/file.js`
4. Перезапустить: `ssh -i /tmp/haba_deploy root@147.45.134.216 "pm2 restart step-bot"`

SSH-ключ: `/tmp/haba_deploy`, сервер: `root@147.45.134.216`
