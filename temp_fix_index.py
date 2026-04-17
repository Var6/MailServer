from pathlib import Path
html = '''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MailServer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'''
Path('frontend/index.html').write_text(html, encoding='utf-8')
print('wrote', Path('frontend/index.html').stat().st_size)
