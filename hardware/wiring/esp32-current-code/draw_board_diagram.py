"""Pin positions transcribed from the user's clear front-view board photo."""
from html import escape
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
W, H = 3000, 2200
BG, INK, MUTED = '#f5f4ef', '#192c3b', '#536572'
RED, GND = '#c34347', '#41515c'
SDA, SCL, DATA = '#008776', '#2073bf', '#7750b6'
ECG, LP, LM = '#c47a18', '#8b54a5', '#b84477'

left = ['EN','VP','VN','D34','D35','D32','D33','D25','D26','D27','D14','D12','D13','GND','VIN']
right = ['D23','D22','TX0','RX0','D21','D19','D18','D5','TX2','RX2','D4','D2','D15','GND','3V3']
ys = {name: 560 + index*70 for index, name in enumerate(right)}
left_ys = {name: 560 + index*70 for index, name in enumerate(left)}

# Fail instead of silently regenerating stale wiring after firmware pin changes.
src = ROOT/'hardware/esp32/src'
assert re.search(r'Wire\.begin\(\s*21,\s*22,\s*MAX30102_I2C_HZ\s*\)', (src/'main.cpp').read_text())
assert re.search(r'ONE_WIRE_BUS\s*=\s*4\b', (src/'sensors/DS18B20_Driver.h').read_text())
ad = (src/'sensors/AD8232_Driver.h').read_text()
for name, pin in [('LO_PLUS',35),('LO_MINUS',32),('ECG_OUTPUT',34)]:
    assert re.search(name+r'\s*=\s*'+str(pin)+r'\b', ad)

im = Image.new('RGB', (W,H), BG)
d = ImageDraw.Draw(im)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       f'<rect width="{W}" height="{H}" fill="{BG}"/>']


def box(x,y,w,h,fill='white',stroke='#d7dfdf',radius=22,width=3):
    d.rounded_rectangle((x,y,x+w,y+h),radius,fill,stroke,width)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')


def line(points,color,width=6):
    d.line(points,fill=color,width=width,joint='curve')
    svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"/>')


def dot(x,y,color,r=9):
    d.ellipse((x-r,y-r,x+r,y+r),fill=color)
    svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')


def text(x,y,value,size=30,color=INK,bold=False,align='left'):
    font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',size)
    length=d.textlength(value,font=font)
    start=x-(length/2 if align=='center' else length if align=='right' else 0)
    assert start>=12 and start+length<=W-12, value
    d.text((start,y),value,font=font,fill=color,anchor='lt')
    anchor={'left':'start','center':'middle','right':'end'}[align]
    svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" text-anchor="{anchor}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')


def net(x,y,name,color):
    box(x-80,y,160,46,'#fffdf8',color,10,3)
    text(x,y+9,name,28,color,True,'center')


def power_lead(x,pin_y,label_y,name,pin,color):
    line([(x,label_y+46),(x,pin_y)],color,5)
    net(x,label_y,name,color)
    text(x+15,pin_y-34,pin,25,color,True)
    dot(x,pin_y,color,7)


text(80,55,'Your ESP32 · exact board connections',64,bold=True)
text(80,140,'Front / component side facing you. Antenna at top. Micro-USB at bottom, as in your photo.',34,MUTED)
box(80,215,2840,100,'#e8eee9','#d1dbd4',18)
text(112,234,'D-labels and header order below match the clear board photo and the current firmware.',31,bold=True)
text(112,275,'All 3V3 labels share the ESP32 3V3 rail. All GND labels share ground. Sensor pin order is schematic; follow module labels.',28,MUTED)

# The board's full front-view header arrangement, including unused pins.
box(1080,420,780,1290,'#173d3c','#10312f',32)
text(1470,453,'ESP32-WROOM-32',36,'#ffffff',True,'center')
line([(1310,590),(1310,520),(1380,520),(1380,570),(1450,570),(1450,520),(1520,520),(1520,570),(1590,570),(1590,520),(1650,520)],'#d6c793',9)
box(1270,650,400,435,'#dbe1de','#8fa6a0',16)
text(1470,800,'ESP-WROOM-32',34,'#304941',True,'center')
text(1470,865,'Wi-Fi + Bluetooth',29,'#4e625c',False,'center')
box(1370,1230,200,160,'#16302c','#92a69a',8)
text(1470,1420,'EN                       BOOT',25,'#bbd6cb',False,'center')
box(1360,1630,220,150,'#c3cfcc','#77958b',12)
text(1470,1680,'USB',38,'#304941',True,'center')
text(1470,1815,'USB AT BOTTOM',32,MUTED,True,'center')

left_active={'D34':ECG,'D35':LP,'D32':LM,'GND':GND}
right_active={'D21':SDA,'D22':SCL,'D4':DATA,'GND':GND,'3V3':RED}
for labels,side,active in [(left,'left',left_active),(right,'right',right_active)]:
    for i,name in enumerate(labels):
        y=560+i*70
        x=1120 if side=='left' else 1820
        color=active.get(name,'#d7c795')
        dot(x,y,color,10)
        if name in active:
            line([(1080 if side=='left' else 1860,y),(x,y)],color,6)
        text(1150 if side=='left' else 1788,y-18,name,32,'#ffffff' if name in active else '#aac1b5',name in active,'left' if side=='left' else 'right')

# ECG: left header D34, D35, D32 are the 4th, 5th, 6th pins from top.
box(80,650,770,470)
text(112,687,'AD8232',44,bold=True)
power_lead(270,650,520,'3V3','3.3V',RED)
power_lead(650,650,520,'GND','GND',GND)
for name,label,color in [('D34','OUT / OUTPUT',ECG),('D35','LO+',LP),('D32','LO−',LM)]:
    y=left_ys[name]
    text(812,y-17,label,33,color,True,'right')
    line([(850,y),(1080,y)],color)
    dot(850,y,color)
text(112,978,'SDN: SparkFun breakout - leave unconnected.',26,RED)
text(112,1013,'Other boards: check their schematic first.',25,MUTED)
text(112,1048,'RA / LA / RL: electrode cable only.',27,MUTED)
text(112,1083,'Do not connect electrode leads to GPIOs.',25,MUTED)

# Optical sensor: right header D22 above D21, matching the actual board.
box(2160,430,760,570)
text(2192,477,'MAX30102',44,bold=True)
text(2192,545,'Pulse / SpO2 breakout · I2C 0x57',29,MUTED)
power_lead(2420,430,345,'3V3','VIN / VCC*',RED)
power_lead(2780,430,345,'GND','GND',GND)
for name,label,color in [('D22','SCL',SCL),('D21','SDA',SDA)]:
    y=ys[name]
    line([(1860,y),(2160,y)],color)
    dot(2160,y,color)
    text(2192,y-17,label,33,color,True)
text(2192,714,'Match the sensor pin labels;',29,MUTED)
text(2192,756,'its header order may differ.',29,MUTED)
text(2192,908,'INT: leave unconnected (polling).',28,MUTED)
text(2192,950,'Check onboard I2C pull-ups; see note below.',26,MUTED)

# Temperature probe: right header D4, with pull-up drawn on its data net.
box(2160,1140,760,360)
text(2192,1176,'DS18B20',44,bold=True)
power_lead(2450,1140,1040,'3V3','VDD',RED)
power_lead(2780,1140,1040,'GND','GND',GND)
y=ys['D4']
line([(1860,y),(2160,y)],DATA)
dot(2160,y,DATA);dot(2020,y,DATA)
text(2192,y-17,'DQ / DATA',33,DATA,True)
net(2020,910,'3V3',RED)
line([(2020,956),(2020,1030)],RED,5)
box(1980,1030,80,100,'#fbf0d8','#a97e2f',2,4)
text(2020,1066,'4k7',28,'#735419',True,'center')
line([(2020,1130),(2020,y)],DATA,5)
text(2020,1315,'4.7 kΩ',29,DATA,True,'center')
text(2020,1355,'pull-up',26,MUTED,False,'center')
text(2192,1350,'Use all three wires: VDD, DATA, GND.',29,MUTED)
text(2192,1402,'Verify the probe pinout; colours vary.',28,MUTED)

# Rail sources, at their real header positions.
line([(1860,ys['GND']),(1940,ys['GND'])],GND,5)
net(2020,ys['GND']-23,'GND',GND)
line([(1860,ys['3V3']),(1940,ys['3V3'])],RED,5)
net(2020,ys['3V3']-23,'3V3',RED)
line([(1040,left_ys['GND']),(1080,left_ys['GND'])],GND,5)
net(960,left_ys['GND']-23,'GND',GND)
text(2150,1564,'Use 3V3 + GND to feed breadboard rails.',27,MUTED)

box(80,1300,770,370,'#e9ece8','#cbd4cd')
text(112,1340,'Phone activity',44,bold=True)
box(112,1408,500,48,'#f2dfad','#e8ce91',10,1)
text(362,1420,'GOOGLE HEALTH',27,'#795c1f',True,'center')
text(112,1490,'Steps sync in the Vyana web app.',31,bold=True)
text(112,1550,'No motion sensor or wiring is required.',28,MUTED)
text(112,1598,'Connect your account in Activity.',28,MUTED)

text(80,1875,'* MAX30102 power assumes a breakout verified for 3.3 V supply and 3.3 V I2C. Bare-chip wiring is different.',29,MUTED)
text(80,1920,'I2C: if suitable pull-ups are absent, add one 4.7 kΩ from SDA to 3V3 and another from SCL to 3V3.',29,MUTED)
text(80,1965,'DS18B20: its separate 4.7 kΩ resistor bridges DATA and 3V3. Leave the ESP32 VIN pin unused for these sensors.',29,MUTED)
box(80,2030,2840,125,'#fff0dd','#e3bc7f',18)
text(112,2049,'UNPLUG USB / BATTERY BEFORE MOVING WIRES.',31,'#8d4c1b',True)
text(112,2101,'Keep ECG electrodes off the body during USB testing. For body-connected use, disconnect computer USB and use standalone battery power.',29,'#724a2d')

im.save(OUT/'esp32-board-connections.png')
(OUT/'esp32-board-connections.svg').write_text('\n'.join(svg+['</svg>']),encoding='utf-8')
print('Verified firmware GPIO mapping and generated:',OUT/'esp32-board-connections.png')
