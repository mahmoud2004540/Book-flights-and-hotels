# الخطة المعمارية ومخطط قاعدة البيانات

> **الحالة:** المرحلة 0 — بانتظار الموافقة. لا يُكتب أي كود قبلها (القسم 15 من البريف).
>
> نسخة مقروءة بتنسيق كامل: انظر الـ Artifact المنشور مع هذه الخطة.

المشروع: منصّة بحث وحجز طيران وفنادق، واجهة عربية RTL أولًا، مبنية على طبقة
محوّلات موحّدة تجعل تبديل أي مزوّد أو بوابة دفع تعديلًا في الإعدادات لا إعادة كتابة.

الاسم المقترح: **رِحلتي** (مؤقت — قابل للتغيير).

---

## 1. القرارات الأربعة

| القرار | الاختيار | القراءة التصميمية |
|---|---|---|
| نموذج العمل | عمولة وسيط / Affiliate | المستخدم يُكمل الدفع عند المزوّد ونأخذ عمولة. لا حاجة لـ IATA/TIDS في المرحلة الأولى. تُبنى جداول `Booking` و`Payment` كاملة من الآن ليكون التحوّل لوكيل سفر كامل تفعيلًا لا إعادة بناء. |
| المزوّدون | Amadeus + Travelpayouts + Duffel + Booking.com | الأربعة كـ `SupplierAdapter` خلف واجهة واحدة. الترتيب الفعلي: Amadeus أولًا (المرحلة 2–3)، ثم Travelpayouts، ثم Duffel و Booking.com بعد اعتماداتهما التجارية. |
| الدفع | Stripe أولًا · Paymob و Tap كمحوّلات | واجهة `PaymentProvider` واحدة. Stripe هو التنفيذ الفعلي في المرحلة 5، ويُوجَّه Paymob (مصر) و Tap (الخليج) لاحقًا حسب بلد التسجيل والعملة. |
| الاستضافة | Vercel + Neon + Upstash | Next.js على Vercel، PostgreSQL على Neon عبر Prisma، Redis على Upstash للكاش و Rate Limiting وطوابير BullMQ. ملفات PDF على Cloudflare R2. |

---

## 2. حدّ الترخيص التجاري — قيد تجاري لا تقني

**إصدار تذكرة طيران حقيقية (Ticketing) ليس مسألة كود.** بيئة
`test.api.amadeus.com` تُرجع بيانات رحلات وأسعار واقعية وتقبل طلبات حجز، لكنها
**لا تُصدر تذاكر صالحة للسفر**. الانتقال إلى Production يتطلب كيانًا تجاريًا
مسجّلًا، واتفاقية تجارية مع Amadeus، و IATA أو TIDS.

- **يعمل كاملًا من أول يوم:** بحث حقيقي في الرحلات والفنادق، مقارنة أسعار، فلترة
  وترتيب، تسجيل مستخدمين، ملف شخصي ومسافرون محفوظون، رحلة حجز بخمس خطوات، لوحة
  مستخدم، لوحة أدمن، إشعارات بالبريد — كلها على بيانات مزوّد حقيقية.
- **يحتاج ترخيصًا:** إصدار PNR وتذكرة صالحة للسفر، وقبض المال مقابل التذكرة.
  حتى ذلك الحين يوجّه زر الإتمام إلى المزوّد برابط عمولة — وهو بالضبط نموذج (أ).

---

## 3. المعمارية — خمس طبقات

```
المتصفّح — Next.js App Router · RSC · TanStack Query · next-intl RTL
        ↓  طلب + JWT
حافة الطلب — API Routes: تحقّق Zod · Rate Limit · حارس الجلسة · Idempotency
        ↓  أوامر متحقَّق منها
خدمات النطاق — بحث · تسعير · حجز · دفع · هامش
        ↓  أنواع موحّدة فقط   ← الحدّ العازل الوحيد
طبقة المحوّلات — SupplierAdapter + Normalizer · PaymentProvider
        ↓  HTTPS · مفاتيح من البيئة
أطراف خارجية — Amadeus · Travelpayouts · Duffel · Booking.com · Stripe · Paymob · Tap
```

بنية تحتية مشتركة تتصل بطبقة خدمات النطاق: PostgreSQL (Neon، عبر Prisma) ·
Redis (Upstash: كاش العروض، Rate Limit، BullMQ) · Cloudflare R2 (تذاكر PDF) ·
Resend (قوالب React Email عربي/إنجليزي) · Sentry.

**القاعدة الحاكمة:** كل طبقة تعرف الطبقة التي تحتها فقط. الواجهة لا تعرف أن
Amadeus موجود، ومنطق الحجز لا يعرف شكل استجابة أي مزوّد. إضافة Duffel لاحقًا =
ملف محوّل جديد + صف في جدول `suppliers`.

### لماذا API Routes لا سيرفر منفصل

نموذج العمولة يعني أن الحمل الفعلي هو **بحث** — عمليات قصيرة كثيرة، وهو ما
تُجيده Vercel Functions. السيرفر المنفصل يصبح ضروريًا عند إصدار التذاكر الحقيقي
بعمليات طويلة، وحينها تُنقل `src/server/` كما هي لأنها مكتوبة دون أي اعتماد على
Next — الفصل متعمد من الخطوة الأولى.

---

## 4. طبقة المحوّلات — العقد الموحّد

`src/server/suppliers/types.ts`

```ts
// العقد الوحيد الذي يعرفه منطق الحجز. لا يمر منه أي نوع خاص بمزوّد.
export interface SupplierAdapter {
  id: SupplierId;
  capabilities: SupplierCapabilities;      // من يدعم فنادق؟ من يدعم إلغاء؟

  // بحث
  autocomplete(q: string, kind: PlaceKind): Promise<NormalizedPlace[]>;
  searchFlights(p: FlightSearchParams): Promise<NormalizedFlightOffer[]>;
  searchHotels(p: HotelSearchParams): Promise<NormalizedHotelOffer[]>;

  // تأكيد السعر قبل الدفع — إجباري
  confirmFlightPrice(offerId: string): Promise<PricedOffer>;
  confirmHotelPrice(offerId: string): Promise<PricedOffer>;

  // حجز
  bookFlight(o: FlightOrderRequest): Promise<BookingConfirmation>;
  bookHotel(o: HotelOrderRequest): Promise<BookingConfirmation>;
  cancelBooking(ref: string): Promise<CancellationResult>;
}

// كل نتيجة ترجع بالسعر الصافي، والهامش يُحسب فوقها في طبقة الخدمات —
// ليبقى الهامش قابلًا للتعديل من لوحة الأدمن دون لمس المحوّلات.
export interface NormalizedFlightOffer {
  offerId: string;                // معرّف داخلي، لا معرّف المزوّد
  supplierId: SupplierId;
  supplierOfferRef: string;       // معرّف المزوّد الأصلي، للتسعير والحجز
  itineraries: Itinerary[];       // ذهاب / عودة / وجهات متعددة
  netPrice: Money;                // السعر الصافي من المزوّد
  fareBreakdown: FareBreakdown;   // أساسي + ضرائب + رسوم
  baggage: BaggageAllowance;
  refundable: boolean;
  expiresAt: Date;                // بعدها تلزم إعادة تسعير
}
```

**قاعدة صارمة (القسم 15):** ممنوع أي بيانات وهمية في الإنتاج. `MockAdapter` واحد
فقط في `src/server/suppliers/mock/`، يُفعَّل حصرًا بـ `SUPPLIER_MOCK_ENABLED=true`
ويرفض العمل عند `NODE_ENV=production`. وجوده لاختبارات التكامل و E2E فقط.

---

## 5. تدفّق البحث

البريف حدّد `Promise.allSettled` — فشل مزوّد لا يُفسد النتيجة كلها:

1. **مفتاح كاش مركّب** من معطيات البحث كلها (المسار، التواريخ، الركاب، الدرجة،
   العملة). إصابة في Redis ترجع فورًا، بصلاحية 5–10 دقائق.
2. **استدعاء متوازٍ** لكل مزوّد نشط يدعم نوع الخدمة، بمهلة 8 ثوانٍ داخلية (أقل من
   الـ15 ثانية الكلية ليبقى وقت للدمج).
3. **قاطع الدائرة:** 5 مرات فشل متتالية = إيقاف 60 ثانية. الحالة في Redis لتكون
   مشتركة بين كل النسخ.
4. **دمج وإزالة تكرار:** نفس الرحلة من مزوّدين مختلفين تُجمع في نتيجة واحدة بأرخص
   سعر، مع الاحتفاظ بمرجع كل مزوّد للتسعير.
5. **الهامش** يُطبَّق بعد الدمج مباشرة؛ `netPrice` لا يخرج للواجهة أبدًا.
6. **عرض تدريجي:** كل مزوّد يصل يُعرض فورًا، والـ Skeleton يبقى للباقي.

كل استدعاء يُسجَّل في `supplier_logs` بالمدة وكود الحالة.

---

## 6. تدفّق الحجز — خمس خطوات وثلاث حمايات

| # | الخطوة | التفاصيل |
|---|---|---|
| 1 | اختيار العرض | تخزين مؤقت في الجلسة — لا في قاعدة البيانات |
| 2 | **إعادة التسعير الإجبارية** | استدعاء `pricing` من المزوّد مرة أخرى، دائمًا |
| 3 | بيانات المسافرين | الاسم كما في الجواز · رقم وتاريخ انتهاء · تحقّق الأعمار |
| 4 | الإضافات | أمتعة · اختيار المقعد · تأمين سفر |
| 5 | الدفع والتأكيد | ملخّص كامل · الموافقة على الشروط · الدفع · ثم إصدار الحجز |

**الحمايات الثلاث:**

- **مؤقّت جلسة 15 دقيقة** بعدّاد تنازلي مرئي؛ انتهاؤه يحرّر العرض.
- **إعادة التسعير:** إذا تغيّر السعر → تنبيه واضح + موافقة صريحة قبل أي استمرار.
  أسعار الطيران تتغيّر بين لحظة البحث ولحظة الدفع، وتخطّي هذه الخطوة يعني بيع
  سعر غير موجود.
- **Idempotency Key** لكل عملية حجز يمنع الحجز المزدوج عند الضغط المتكرر أو
  انقطاع الشبكة.
- **الفشل الجزئي:** دفع نجح + حجز فشل ← استرداد تلقائي فوري + تنبيه أدمن + إشعار
  المستخدم.

كل خطوة قابلة للرجوع للخلف دون فقدان البيانات المدخلة.

---

## 7. هيكل المجلدات

القسم 15 يفرض ملفات أقل من 300 سطر؛ الهيكل مقسّم ليجعل ذلك طبيعيًا لا مجهودًا.

```
src/
├─ app/
│  ├─ [locale]/                  // ar افتراضي · en
│  │  ├─ (marketing)/            // الرئيسية · من نحن · الشروط · الخصوصية
│  │  ├─ (search)/flights|hotels/
│  │  ├─ (booking)/checkout/[step]/
│  │  ├─ (account)/dashboard/    // حجوزاتي · المفضّلة · الملف الشخصي
│  │  └─ (admin)/                // محمي بـ role
│  └─ api/
│     ├─ auth/[...nextauth]/
│     ├─ search/{flights,hotels,places}/
│     ├─ offers/[id]/price/      // إعادة التسعير
│     ├─ bookings/               // POST بمفتاح Idempotency
│     ├─ payments/{intent,webhook}/
│     └─ admin/
│
├─ server/                       // لا استيراد من next/* هنا — متعمد
│  ├─ suppliers/
│  │  ├─ types.ts                // العقد الموحّد
│  │  ├─ registry.ts             // اختيار المزوّدين النشطين
│  │  ├─ orchestrator.ts         // allSettled + دمج + إزالة تكرار
│  │  ├─ resilience/             // إعادة المحاولة · قاطع الدائرة · المهل
│  │  ├─ amadeus/                // client · normalizers · mappers
│  │  ├─ travelpayouts/  duffel/  bookingcom/
│  │  └─ mock/                   // اختبارات فقط — محجوب في الإنتاج
│  ├─ payments/                  // PaymentProvider + stripe/ paymob/ tap/
│  ├─ booking/                   // آلة حالة الحجز · Idempotency · استرداد
│  ├─ pricing/                   // الهامش · أكواد الخصم · تحويل العملة
│  ├─ notifications/             // قوالب React Email + مهام BullMQ
│  └─ pdf/                       // توليد التذكرة
│
├─ lib/                          // zod schemas · تنسيق التواريخ والعملات · i18n
├─ components/                   // ui/ (shadcn) · flights/ · hotels/ · booking/
└─ messages/                     // ar.json · en.json — لا نص ثابت في المكوّنات

prisma/          // schema.prisma · migrations/ · seed.ts
tests/           // unit/ · integration/ · e2e/ (Playwright)
docs/            // ARCHITECTURE.md · postman-collection.json · DEPLOYMENT.md
```

---

## 8. مخطط قاعدة البيانات

كل الجداول المطلوبة في القسم 6، زائد جداول المصادقة التي يحتاجها NextAuth.

```prisma
generator client   { provider = "prisma-client-js" }
datasource db      { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role            { USER SUPPORT FINANCE SUPER_ADMIN }
enum ServiceType     { FLIGHT HOTEL }
enum BookingStatus   { PENDING CONFIRMED CANCELLED FAILED REFUNDED }
enum PaymentStatus   { REQUIRES_ACTION PROCESSING SUCCEEDED FAILED REFUNDED PARTIALLY_REFUNDED }
enum RefundStatus    { PENDING SUCCEEDED FAILED }
enum PassengerType   { ADULT CHILD INFANT }
enum AmountType      { PERCENT FIXED }
enum NotifChannel    { EMAIL IN_APP WHATSAPP SMS }
enum Locale          { AR EN }
enum Currency        { EGP USD SAR AED EUR }

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?                        // null لو دخل بـ OAuth فقط
  name            String?
  phone           String?
  role            Role      @default(USER)
  locale          Locale    @default(AR)
  currency        Currency  @default(EGP)
  emailVerifiedAt DateTime?
  twoFactorSecret String?                        // مشفّر — 2FA اختياري
  isBlocked       Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  profile       Profile?
  travelers     SavedTraveler[]
  bookings      Booking[]
  searches      Search[]
  favorites     Favorite[]
  notifications Notification[]
  accounts      Account[]      // NextAuth
  sessions      Session[]      // NextAuth

  @@index([role])
  @@index([createdAt])
}

model Profile {
  userId          String    @id
  dob             DateTime?
  nationality     String?                        // ISO 3166-1 alpha-2
  passportNoEnc   String?                        // AES-256-GCM — القسم 8
  passportExpiry  DateTime?
  preferences     Json      @default("{}")
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SavedTraveler {
  id            String        @id @default(cuid())
  userId        String
  firstName     String
  lastName      String
  dob           DateTime
  nationality   String?
  passportNoEnc String?
  type          PassengerType
  createdAt     DateTime      @default(now())
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Search {
  id           String      @id @default(cuid())
  userId       String?                            // null للزائر
  type         ServiceType
  params       Json
  resultsCount Int         @default(0)
  durationMs   Int?
  createdAt    DateTime    @default(now())
  user         User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@index([createdAt])                            // مطلوب صراحةً في القسم 6
  @@index([userId, createdAt])
}

model OffersCache {
  cacheKey   String   @id
  supplierId String
  payload    Json
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  @@index([expiresAt])                            // مطلوب صراحةً في القسم 6
}

model Booking {
  id             String        @id @default(cuid())
  reference      String        @unique            // المرجع الظاهر للمستخدم
  userId         String?                          // null لحجز الضيف
  guestEmail     String?
  type           ServiceType
  supplierId     String
  supplierRef    String?                          // مرجع المزوّد
  pnr            String?
  status         BookingStatus @default(PENDING)

  netAmount      Decimal       @db.Decimal(12,2)  // سعر المزوّد
  markupAmount   Decimal       @db.Decimal(12,2)  // الهامش
  discountAmount Decimal       @db.Decimal(12,2)  @default(0)
  totalAmount    Decimal       @db.Decimal(12,2)  // ما يدفعه المستخدم
  currency       Currency

  idempotencyKey String        @unique            // الحماية من الحجز المزدوج
  promoCodeId    String?
  expiresAt      DateTime?                        // مهلة الجلسة للحجوزات المعلّقة
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  user       User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  supplier   Supplier      @relation(fields: [supplierId], references: [id])
  promoCode  PromoCode?    @relation(fields: [promoCodeId], references: [id])
  items      BookingItem[]
  passengers Passenger[]
  payments   Payment[]

  @@index([userId, status])                       // مطلوب صراحةً في القسم 6
  @@index([status, expiresAt])                    // لتنظيف الحجوزات المعلّقة
  @@index([createdAt])
}

model BookingItem {
  id        String  @id @default(cuid())
  bookingId String
  itemType  String                                 // flight_segment · hotel_room · baggage · seat · insurance
  details   Json
  amount    Decimal @db.Decimal(12,2) @default(0)
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([bookingId])
}

model Passenger {
  id             String        @id @default(cuid())
  bookingId      String
  firstName      String
  lastName       String
  dob            DateTime
  nationality    String?
  passportNoEnc  String?                           // مشفّر — القسم 8
  passportExpiry DateTime?
  type           PassengerType
  booking        Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([bookingId])
}

model Payment {
  id          String        @id @default(cuid())
  bookingId   String
  provider    String                               // stripe · paymob · tap
  providerRef String        @unique                // PaymentIntent id
  amount      Decimal       @db.Decimal(12,2)
  currency    Currency
  status      PaymentStatus @default(PROCESSING)
  rawResponse Json?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  booking     Booking       @relation(fields: [bookingId], references: [id])
  refunds     Refund[]
  @@index([bookingId])
  @@index([status])
}

model Refund {
  id          String       @id @default(cuid())
  paymentId   String
  amount      Decimal      @db.Decimal(12,2)
  reason      String
  status      RefundStatus @default(PENDING)
  providerRef String?
  createdAt   DateTime     @default(now())
  payment     Payment      @relation(fields: [paymentId], references: [id])
  @@index([paymentId])
}

model Supplier {
  id          String        @id                    // amadeus · travelpayouts · duffel · bookingcom
  name        String
  isActive    Boolean       @default(false)
  priority    Int           @default(100)          // الأقل = الأعلى أولوية
  config      Json          @default("{}")         // إعدادات فقط — ممنوع أي مفاتيح
  bookings    Booking[]
  markupRules MarkupRule[]
  logs        SupplierLog[]
}

model MarkupRule {
  id          String       @id @default(cuid())
  supplierId  String?                              // null = كل المزوّدين
  serviceType ServiceType?                         // null = الاثنان
  destination String?                              // كود IATA أو دولة — null = الكل
  type        AmountType
  value       Decimal      @db.Decimal(10,2)
  priority    Int          @default(100)           // الأكثر تحديدًا يفوز
  isActive    Boolean      @default(true)
  supplier    Supplier?    @relation(fields: [supplierId], references: [id])
  @@index([isActive, priority])
}

model PromoCode {
  id           String     @id @default(cuid())
  code         String     @unique
  discountType AmountType
  value        Decimal    @db.Decimal(10,2)
  maxUses      Int?
  usedCount    Int        @default(0)
  minAmount    Decimal?   @db.Decimal(12,2)
  validFrom    DateTime
  validTo      DateTime
  isActive     Boolean    @default(true)
  bookings     Booking[]
  @@index([code, isActive])
}

model Favorite {
  id        String      @id @default(cuid())
  userId    String
  type      ServiceType
  payload   Json                                   // لقطة العرض المحفوظ
  lastPrice Decimal?    @db.Decimal(12,2)          // لتنبيه تغيّر السعر
  createdAt DateTime    @default(now())
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Notification {
  id        String       @id @default(cuid())
  userId    String
  type      String
  channel   NotifChannel
  payload   Json
  sentAt    DateTime?
  readAt    DateTime?
  createdAt DateTime     @default(now())
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt])
}

model SupplierLog {
  id         String   @id @default(cuid())
  supplierId String
  endpoint   String
  durationMs Int
  statusCode Int?
  error      String?
  createdAt  DateTime @default(now())
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  @@index([supplierId, createdAt])
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  action    String
  entity    String
  entityId  String
  diff      Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([actorId, createdAt])
}

// جداول NextAuth القياسية: Account · Session · VerificationToken
// زائد PasswordResetToken بصلاحية ساعة واحدة (القسم 4.4).
```

### الاختلافات المتعمدة عن القسم 6

- **`Decimal(12,2)` بدل أرقام عائمة** للمبالغ كلها. حساب المال بـ float يولّد
  فروق قروش تتراكم — غير مقبول في نظام دفع.
- **`discountAmount` و`reference` مضافان** إلى `bookings`: البريف طلب أكواد خصم
  في القسم 4.7 دون ربطها بالحجز، والمستخدم يحتاج مرجعًا ظاهرًا غير `id` الداخلي.
- **`favorites` جدول جديد**: القسم 4.6 طلب قائمة مفضّلة وتنبيه تغيّر السعر، ولا
  جدول لها في القسم 6.
- **`expiresAt` على `bookings`**: مهلة الـ15 دقيقة يجب أن تكون في قاعدة البيانات
  لا في الذاكرة، لتجدها مهمة تنظيف الحجوزات المعلّقة (BullMQ).
- **أرقام الجوازات في أعمدة `...Enc`**: التشفير مطلوب في القسم 8، والتسمية تجعل
  أي كتابة بنص صريح غلطة ظاهرة في المراجعة.
- **`priority` على `markup_rules`**: بدونه تتعارض قاعدة «كل المزوّدين» وقاعدة
  «مصر فقط» دون حسم.

---

## 9. الأمان والأداء

| المحور | القرار |
|---|---|
| المصادقة | JWT عمره 15 دقيقة + Refresh Token عمره 30 يومًا في كوكي `httpOnly` و`SameSite=Lax`. 5 محاولات فاشلة = قفل 15 دقيقة، بعدّاد في Redis على الإيميل والـ IP معًا. |
| البيانات الحسّاسة | أرقام الجوازات مشفّرة AES-256-GCM بمفتاح من البيئة. بيانات الكروت لا تلمس سيرفراتنا — Stripe Elements يبقينا في نطاق PCI-DSS SAQ-A. |
| حدود الطلبات | 30 بحث/دقيقة للمستخدم و100 للـ IP بنافذة منزلقة على Upstash. الـ autocomplete بـ debounce 300ms على الواجهة وحدّ منفصل على السيرفر. |
| الأخطاء | رسائل عامة للمستخدم، تفاصيل كاملة في Sentry. ممنوع `try/catch` فارغ — كل تعامل مع طرف خارجي يرجع نتيجة صريحة بنجاح أو فشل بسبب مصنّف. |
| الأداء | كاش 5–10 دقائق للبحث، ISR لصفحات الوجهات الثابتة، تقسيم الحزم لكل مسار، صور WebP عبر `next/image`. الهدف: Lighthouse ≥ 90 و LCP < 2.5 ثانية. |
| الامتثال | سجل تدقيق لكل عملية حسّاسة، تصدير بيانات وحذف حساب (GDPR)، سجل موافقات، رؤوس CSP و HSTS، حماية CSRF على كل طلب مغيّر للحالة. |

---

## 10. متغيّرات البيئة

ملحق البريف كامل، مع الإضافات التي استلزمتها القرارات (معلّمة بـ `+`). لا مفاتيح
داخل الكود إطلاقًا — القسم 3.3.

```bash
# قاعدة البيانات والكاش
DATABASE_URL=                      # Neon — مع ?sslmode=require
REDIS_URL=                         # Upstash

# المصادقة
NEXTAUTH_SECRET=                   # openssl rand -base64 32
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
ENCRYPTION_KEY=                    # + 32 بايت hex لتشفير الجوازات

# المزوّدون
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
AMADEUS_BASE_URL=https://test.api.amadeus.com
TRAVELPAYOUTS_TOKEN=               # +
TRAVELPAYOUTS_MARKER=              # + معرّف الشريك للعمولة
DUFFEL_ACCESS_TOKEN=               # + مرحلة لاحقة
BOOKINGCOM_API_KEY=                # + مرحلة لاحقة
SUPPLIER_MOCK_ENABLED=false        # + الاختبارات فقط، محجوب في الإنتاج

# الدفع
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
PAYMOB_API_KEY=
PAYMOB_HMAC_SECRET=                # + التحقق من الـ webhook إجباري
TAP_SECRET_KEY=                    # +

# الإيميل والتخزين والخرائط
RESEND_API_KEY=
EMAIL_FROM=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=                       # + Cloudflare R2
NEXT_PUBLIC_MAPBOX_TOKEN=

# المراقبة والتطبيق
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
DEFAULT_MARKUP_PERCENT=            # مثال: 4.5
```

---

## 11. خارطة الطريق

الترتيب كما حدّده القسم 16. وقفة وانتظار موافقة بعد كل مرحلة (القسم 15).

| # | المرحلة | التسليم الذي يثبت اكتمالها | الحالة |
|---|---|---|---|
| 0 | البنية والإعداد | مشروع Next.js يعمل، Prisma مهاجَر على Neon، نظام التصميم والـ tokens، توطين عربي/إنجليزي بـ RTL كامل | **هذه الخطة** |
| 1 | المصادقة والملف الشخصي | تسجيل بالإيميل + تأكيد، Google و Apple، استعادة كلمة المرور، المسافرون المحفوظون | التالية |
| 2 | تكامل Amadeus وبحث الطيران | محوّل ومطبِّع كاملان، صفحة نتائج بفلاتر وترتيب، شريط تواريخ ±3، عرض تدريجي | لاحقًا |
| 3 | بحث الفنادق والخريطة | عرض مزدوج قائمة + خريطة تفاعلية، صفحة تفاصيل الفندق، فلاتر المرافق والتقييم | لاحقًا |
| 4 | رحلة الحجز | الخمس خطوات، إعادة التسعير الإجبارية، مؤقّت الجلسة، تحقّق بيانات المسافرين | لاحقًا |
| 5 | الدفع والإصدار | Stripe مع 3DS، webhooks متحقَّق منها، تذكرة PDF، إيميل تأكيد عربي وإنجليزي | لاحقًا |
| 6 | لوحة المستخدم | حجوزات قادمة وسابقة وملغاة، إلغاء واسترداد بشروط المزوّد، تنبيهات ما قبل السفر | لاحقًا |
| 7 | لوحة الأدمن | إحصائيات، إدارة الحجوزات والمستخدمين، قواعد الهامش، تفعيل المزوّدين، صلاحيات متدرّجة | لاحقًا |
| 8 | الأداء والأمان والنشر | اختبارات وحدة وتكامل و E2E، تدقيق أمني، Lighthouse ≥ 90، نشر على Vercel، قائمة ما قبل الإطلاق | لاحقًا |

---

## 12. المطلوب للانطلاق

للموافقة كما هي: **«ابدأ المرحلة 0»**. وإلا فهذه النقاط المرشّحة للتعديل:

1. **اسم المشروع** — «رِحلتي» اسم مؤقت.
2. **ترتيب المزوّدين** — حاليًا Amadeus ← Travelpayouts ← Duffel ← Booking.com.
   تقديم Travelpayouts لعمولة أسرع تغيير مقبول وغير مكلف.
3. **نسبة الهامش الافتراضية** لـ `DEFAULT_MARKUP_PERCENT` — المعتاد 3%–6%.
4. **الأسواق المستهدفة** — تحدد توقيت إدخال Paymob و Tap، والعملة الافتراضية.

الالتزامات المستمرة (القسم 15): لا كود قبل الموافقة، وقفة بعد كل مرحلة،
TypeScript صارم بلا `any`، ملفات تحت 300 سطر، ولا بيانات وهمية في مسار الإنتاج.
