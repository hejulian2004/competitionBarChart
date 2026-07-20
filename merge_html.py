with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

with open('style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

with open('main.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Replace <link rel="stylesheet" href="style.css" /> with <style>css_content</style>
standalone_html = html_content.replace('<link rel="stylesheet" href="style.css" />', f'<style>\n{css_content}\n</style>')

# Replace <script src="main.js"></script> with <script>js_content</script>
standalone_html = standalone_html.replace('<script src="main.js"></script>', f'<script>\n{js_content}\n</script>')

with open('bar_chart_race_external_labels_no_overflow.html', 'w', encoding='utf-8') as f:
    f.write(standalone_html)

print("Updated standalone HTML with enlarged Danmaku text successfully!")
