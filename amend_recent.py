import subprocess
import os

def run_out(cmd):
    return subprocess.check_output(cmd).decode('utf-8').strip()

commits = run_out(['git', 'log', '--format=%H', '--reverse', 'origin/main..main']).split('\n')
commits = [c for c in commits if c]

if not commits:
    print("No commits to rewrite!")
    exit(0)

last_new_commit = run_out(['git', 'rev-parse', 'origin/main'])

for commit in commits:
    msg = run_out(['git', 'log', '-1', '--format=%B', commit])
    new_msg_lines = [line for line in msg.split('\n') if 'Co-Authored-By: Claude' not in line]
    new_msg = '\n'.join(new_msg_lines).strip() + '\n'
    
    tree = run_out(['git', 'log', '-1', '--format=%T', commit])
    author_name = run_out(['git', 'log', '-1', '--format=%an', commit])
    author_email = run_out(['git', 'log', '-1', '--format=%ae', commit])
    author_date = run_out(['git', 'log', '-1', '--format=%aI', commit])
    
    cmd = ['git', 'commit-tree', tree, '-p', last_new_commit]
    
    with open('msg.txt', 'w', encoding='utf-8') as f:
        f.write(new_msg)
        
    env = os.environ.copy()
    env['GIT_AUTHOR_NAME'] = author_name
    env['GIT_AUTHOR_EMAIL'] = author_email
    env['GIT_AUTHOR_DATE'] = author_date
    env['GIT_COMMITTER_NAME'] = author_name
    env['GIT_COMMITTER_EMAIL'] = author_email
    # We omit committer date so it uses current time, or we can use author date to be safe
    env['GIT_COMMITTER_DATE'] = author_date
    
    with open('msg.txt', 'rb') as f:
        new_commit = subprocess.check_output(cmd, stdin=f, env=env).decode('utf-8').strip()
        
    last_new_commit = new_commit

subprocess.check_call(['git', 'reset', '--hard', last_new_commit])
subprocess.check_call(['git', 'push', 'origin', 'main'])
if os.path.exists('msg.txt'):
    os.remove('msg.txt')
print("Successfully rewritten and pushed new commits.")
