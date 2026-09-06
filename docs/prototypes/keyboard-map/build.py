from pathlib import Path
from html import escape
svg=['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 414" role="img" aria-labelledby="key-map-title key-map-description">
<title id="key-map-title">Harmony Grid keyboard map</title><desc id="key-map-description">A relational map of the controls: Tab sets root. Q W E R adjust tempo; T toggles the metronome. A S decrement and increment tempo. Y toggles Drone. D repeats, F toggles Sustain, G holds. Command latches keys marked L. C V copy and paste. Hold N or M to collect chords or modes, then release to name. Shift or Caps Lock changes the digit and copy/paste target; both together select chords. Space sustains. Grid-axis arrows are on-screen controls with Set and Cancel.</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#e6e9df}.group{fill:#14201a;stroke:#4c6756;stroke-dasharray:3 5}.cap{fill:#26392e;stroke:#7c9c86;stroke-width:1.3}.label{font-size:12px;fill:#b8cabc}.letter{font-size:20px;font-weight:550}.tiny{font-size:11px;fill:#a7baad}.heading{font-size:10px;letter-spacing:1.4px;fill:#a3ddc6;font-weight:650}.latch{font-size:10px;fill:#a3ddc6;font-weight:700}.link{stroke:#6c8d77;fill:none;stroke-width:1.2}</style>
<rect class="group" x="136" y="22" width="370" height="172" rx="12"/><text class="heading" x="152" y="41">TEMPO &amp; PULSE</text>
<rect class="group" x="525" y="113" width="262" height="81" rx="12"/><text class="heading" x="541" y="123">RETAIN &amp; REPEAT</text>
<rect class="group" x="524" y="213" width="365" height="99" rx="12"/><text class="heading" x="540" y="234">COPY &amp; CREATE</text>
''']
def key(x,y,letter,label,w=54,latch=False):
 svg.append(f'<g data-key="{escape(letter)}"><text class="label" x="{x+w/2}" y="{y-8}" text-anchor="middle">{escape(label)}</text><rect class="cap" x="{x}" y="{y}" width="{w}" height="42" rx="10"/><text class="letter" x="{x+w/2}" y="{y+28}" text-anchor="middle">{escape(letter)}</text>'+ (f'<text class="latch" x="{x+w-13}" y="{y+13}">L</text>' if latch else '')+'</g>')
key(24,67,'Tab','Set root',85)
for x,l,label in [(152,'Q','½'),(223,'W','2×'),(294,'E','⅔'),(365,'R','³⁄₂')]:key(x,67,l,label,latch=True)
key(436,67,'T','On / off')
key(552,67,'Y','Drone · toggle')
key(171,146,'A','−1');key(242,146,'S','+1')
svg.append('<text class="tiny" x="326" y="164">Hold ratios temporarily.</text><text class="tiny" x="326" y="180">⌘ makes them permanent.</text>')
key(544,146,'D','Repeat',latch=True);key(628,146,'F','Sustain · toggle');key(712,146,'G','Hold',latch=True)
key(24,242,'⌘','Latch marked keys',85)
svg.append('<text class="tiny" x="24" y="301">⌘ + L-marked key</text>')
# Axis controls deliberately differentiated from physical keycaps.
svg.append('''<rect x="151" y="218" width="331" height="95" rx="10" fill="#1a2920" stroke="#4c6756"/><text class="heading" x="167" y="238">GRID AXES · ON-SCREEN</text><text class="letter" x="175" y="280">←  H  →</text><text class="letter" x="282" y="260">↑</text><text class="label" x="286" y="279">V</text><text class="letter" x="282" y="301">↓</text><text class="tiny" x="330" y="264">1–12 semitones</text><text class="tiny" x="330" y="284">Set / Cancel</text>''')
key(541,259,'C','Copy');key(612,259,'V','Paste');key(723,259,'N','Chord');key(806,259,'M','Mode')
svg.append('<text class="tiny" x="793" y="326" text-anchor="middle">Hold to collect · release to name</text>')
key(24,353,'Shift','Mode / chord',85);key(120,353,'Caps','',85)
svg.append('''<path class="link" d="M213 374h22m-5-5 5 5-5 5"/><rect x="246" y="351" width="61" height="24" rx="4" fill="#a3ddc6"/><text x="276" y="367" text-anchor="middle" style="fill:#153424;font-size:12px">Mode</text><rect x="310" y="351" width="64" height="24" rx="4" fill="#26392e" stroke="#668770"/><text x="342" y="367" text-anchor="middle" font-size="12">Chord</text><text class="tiny" x="246" y="390">Either selects Mode; both select Chord.</text><text class="tiny" x="246" y="405">0–9 selects the slot.</text>''')
key(540,353,'Space','Sustain · hold',326)
svg.append('</svg>')
Path(__file__).with_name('keyboard-map.svg').write_text(''.join(svg))
