"""Roda todos os scripts de peca (cada um num processo bpy proprio) e mostra o tempo de cada um."""
import subprocess, sys, time, os
HERE = os.path.dirname(os.path.abspath(__file__))
PIECES = ['bonfire', 'pillar', 'gravestone', 'gothic_arch', 'fog_gate', 'ruined_statue']
only = sys.argv[1:] or PIECES
for p in only:
    t = time.time()
    r = subprocess.run([sys.executable, os.path.join(HERE, p + '.py')], capture_output=True, text=True)
    line = [l for l in r.stdout.splitlines() if l.startswith('RESULT')]
    print('%-14s %s  (%.0fs)%s' % (p, line[-1] if line else 'FALHOU', time.time() - t,
                                   '' if r.returncode == 0 else '\n' + r.stderr[-800:]))
