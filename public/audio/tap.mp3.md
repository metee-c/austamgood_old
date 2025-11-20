# Audio File: tap.mp3

## คำแนะนำ

ไฟล์ `tap.mp3` ใช้สำหรับเสียงยืนยันเมื่อกดปุ่มหรือแตะหน้าจอ

### ลักษณะเสียงที่แนะนำ:
- **ความยาว**: 0.1-0.2 วินาที
- **ความดัง**: ปานกลางถึงเบา
- **ลักษณะ**: Click หรือ Tap เสียงสั้นกระทัดรัด
- **Volume**: 0.3 (30% ของเสียงเต็ม)

### แหล่งเสียงฟรี:
1. **Freesound.org** - https://freesound.org
   - ค้นหา: "tap", "click", "button"

2. **Zapsplat.com** - https://www.zapsplat.com
   - หมวด: UI Sounds

3. **Mixkit.co** - https://mixkit.co/free-sound-effects/click/
   - Free UI Click Sounds

### วิธีใช้:
```typescript
const audio = new Audio('/audio/tap.mp3');
audio.volume = 0.3;
audio.play().catch(() => {});
```

### หมายเหตุ:
- ใช้ `.catch(() => {})` เพื่อป้องกัน autoplay policy error
- ตั้ง volume เป็น 0.3 เพื่อไม่ให้เสียงดังเกินไป
- ไฟล์ควรมีขนาดเล็ก (< 50KB) เพื่อโหลดเร็ว
