import math
def oklch_to_srgb(L,C,H):
    h=math.radians(H); a=C*math.cos(h); b=C*math.sin(h)
    l_=L+0.3963377774*a+0.2158037573*b
    m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r= 4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bl=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    def g2(c):
        c=max(0.0,min(1.0,c))
        return 12.92*c if c<=0.0031308 else 1.055*(c**(1/2.4))-0.055
    return tuple(round(g2(x)*255) for x in (r,g,bl))
def lum(rgb):
    def f(c):
        c/=255
        return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b=[f(x) for x in rgb]
    return 0.2126*r+0.7152*g+0.0722*b
def cr(c1,c2):
    L1,L2=lum(c1),lum(c2); hi,lo=max(L1,L2),min(L1,L2)
    return (hi+0.05)/(lo+0.05)
tok={
 'light.background':(0.98,0.015,300),'light.foreground':(0.22,0.08,300),
 'light.card':(1,0,0),'light.primary':(0.5,0.24,300),'light.primary-fg':(0.99,0.005,300),
 'light.muted-fg':(0.5,0.06,300),'light.secondary':(0.95,0.04,300),'light.secondary-fg':(0.35,0.18,300),
 'light.accent':(0.92,0.07,300),'light.accent-fg':(0.35,0.2,300),'light.border':(0.9,0.04,300),
 'light.destructive':(0.6,0.24,27),'light.destructive-fg':(0.99,0.005,300),
 'dark.background':(0.15,0.05,300),'dark.foreground':(0.98,0.01,300),'dark.card':(0.22,0.08,300),
 'dark.primary':(0.7,0.22,300),'dark.primary-fg':(0.15,0.05,300),'dark.muted-fg':(0.72,0.05,300),
 'dark.muted':(0.28,0.06,300),
}
rgb={k:oklch_to_srgb(*v) for k,v in tok.items()}
pairs=[
 ('body text','light.foreground','light.background',4.5),
 ('body text on card','light.foreground','light.card',4.5),
 ('muted/secondary text on bg','light.muted-fg','light.background',4.5),
 ('muted/secondary text on card','light.muted-fg','light.card',4.5),
 ('link / primary text on bg','light.primary','light.background',4.5),
 ('link / primary text on card','light.primary','light.card',4.5),
 ('primary button label','light.primary-fg','light.primary',4.5),
 ('secondary button label','light.secondary-fg','light.secondary',4.5),
 ('accent/badge label','light.accent-fg','light.accent',4.5),
 ('destructive button label','light.destructive-fg','light.destructive',4.5),
 ('border vs background (1.4.11 non-text, needs 3.0)','light.border','light.background',3.0),
 ('border vs card (1.4.11 non-text, needs 3.0)','light.border','light.card',3.0),
 ('DARK body text','dark.foreground','dark.background',4.5),
 ('DARK muted text on bg','dark.muted-fg','dark.background',4.5),
 ('DARK muted text on card','dark.muted-fg','dark.card',4.5),
 ('DARK primary link on bg','dark.primary','dark.background',4.5),
 ('DARK primary button label','dark.primary-fg','dark.primary',4.5),
]
print(f"{'pair':<52}{'ratio':>8}  {'needs':>5}  verdict   fg / bg")
for name,f,b,need in pairs:
    r=cr(rgb[f],rgb[b])
    v='PASS' if r>=need else 'FAIL'
    print(f"{name:<52}{r:>7.2f}:1 {need:>5}   {v:<8} rgb{rgb[f]} / rgb{rgb[b]}")

print("\n=== solving for accessible token values ===")
bg_light=oklch_to_srgb(0.98,0.015,300); card=(255,255,255)
# border/input: need >=3.0 against BOTH bg and white card
for L in [x/100 for x in range(40,90)]:
    c=oklch_to_srgb(L,0.04,300)
    if cr(c,bg_light)>=3.0 and cr(c,card)>=3.0:
        print(f"--border/--input  oklch({L:.2f} 0.04 300) -> rgb{c}  vs bg {cr(c,bg_light):.2f}:1  vs card {cr(c,card):.2f}:1"); break
# destructive: white-ish text must hit 4.5
white=oklch_to_srgb(0.99,0.005,300)
for L in [x/1000 for x in range(600,300,-5)]:
    c=oklch_to_srgb(L,0.24,27)
    if cr(white,c)>=4.5:
        print(f"--destructive     oklch({L:.3f} 0.24 27) -> rgb{c}  label contrast {cr(white,c):.2f}:1"); break
# dark-mode border
bg_dark=oklch_to_srgb(0.15,0.05,300); card_dark=oklch_to_srgb(0.22,0.08,300)
for L in [x/100 for x in range(30,90)]:
    c=oklch_to_srgb(L,0.03,300)
    if cr(c,bg_dark)>=3.0 and cr(c,card_dark)>=3.0:
        print(f"DARK --border     oklch({L:.2f} 0.03 300) -> rgb{c}  vs bg {cr(c,bg_dark):.2f}:1  vs card {cr(c,card_dark):.2f}:1"); break
