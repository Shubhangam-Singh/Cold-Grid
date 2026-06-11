import subprocess

def run_out(cmd):
    return subprocess.check_output(cmd).decode('utf-8').strip()

# Get the original message of the latest commit
msg = run_out(['git', 'log', '-1', '--format=%B'])

# Remove Claude
new_msg_lines = [line for line in msg.split('\n') if 'Co-Authored-By: Claude' not in line]
new_msg = '\n'.join(new_msg_lines).strip() + '\n'

with open('msg.txt', 'w', encoding='utf-8') as f:
    f.write(new_msg)

# Amend the commit
subprocess.check_call(['git', 'commit', '--amend', '-F', 'msg.txt'])

# Push to GitHub
subprocess.check_call(['git', 'push', 'origin', 'main'])

print("Phase 5 commit amended and pushed successfully!")
