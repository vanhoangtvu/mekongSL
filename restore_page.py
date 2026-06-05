import json

log_path = "/home/hv/.gemini/antigravity-ide/brain/f08abe60-dae2-473d-ba04-c8929fd95527/.system_generated/logs/transcript.jsonl"
target_file_path = "/home/hv/DuAn/Mekong/frontend/src/app/(public)/data/page.tsx"

with open(log_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Line 176 is index 175 (since lines are 1-indexed)
line_data = json.loads(lines[175])
args = line_data["tool_calls"][0]["args"]

target_content = args["TargetContent"]
replacement_content = args["ReplacementContent"]

# Unescape string if it was escaped as a JSON string
# Wait, json.loads has already unescaped it when parsing line_data, 
# but args["TargetContent"] and args["ReplacementContent"] are still strings.
# Wait, let's print them to check.

with open(target_file_path, "r", encoding="utf-8") as f:
    file_content = f.read()

# Let's clean up escape characters if any, but json.loads does it.
if target_content in file_content:
    new_content = file_content.replace(target_content, replacement_content)
    with open(target_file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("SUCCESS: Replaced content successfully!")
else:
    # Let's print out if target_content is slightly different
    print("ERROR: TargetContent not found!")
    # Let's print the first 100 characters of target_content
    print("Target start:", repr(target_content[:100]))
    print("Target end:", repr(target_content[-100:]))
