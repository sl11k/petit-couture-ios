import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTr } from "@/i18n/tr";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/our-story")({
  head: () =>
    buildMeta({
      title: "Our Story — Le Petit Paradis",
      description:
        "From Lace Palace (1955) in Belgium to Le Petit Paradis — four generations of European craftsmanship in luxury children's clothing.",
      path: "/our-story",
    }),
  component: OurStoryPage,
});

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      {eyebrow && (
        <p className="text-[10.5px] tracking-[0.22em] text-gold-deep uppercase mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif text-2xl md:text-3xl text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

function TimelineItem({ year, title, body }: { year: string; title: string; body: string }) {
  return (
    <li className="relative ps-6 pb-8 border-s border-gold/30 last:pb-0">
      <span className="absolute -start-[7px] top-1 h-3 w-3 rounded-full bg-gold" />
      <p className="text-[11px] tracking-[0.2em] text-gold-deep">{year}</p>
      <h3 className="mt-1 font-serif text-lg text-foreground">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground/80">{body}</p>
    </li>
  );
}

function OurStoryPage() {
  const { isRTL } = useLanguage();
  const tr = useTr();

  return (
    <article
      className="mx-auto max-w-3xl px-5 md:px-6 py-12 md:py-16"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Hero */}
      <header className="text-center">
        <p className="text-[10.5px] tracking-[0.22em] text-gold-deep uppercase">
          {tr("قصتنا", "Our Story")}
        </p>
        <h1 className="mt-3 font-serif text-3xl md:text-5xl leading-tight text-foreground">
          {tr("قصّتنا تبدأ بالدانتيل", "Our Story starts with Lace")}
        </h1>
      </header>

      {/* How it all started */}
      <Section
        eyebrow={tr("كيف بدأ كل شيء", "How it all Started")}
        title={tr("Lace Palace (1955)", "Lace Palace (1955)")}
      >
        <p>
          {tr(
            "Lace Palace — مشروع عائلي تأسّس عام 1955 في بلجيكا — بنى سمعته على أعمال الدانتيل الراقية، والحِرفية الخالدة، والاحترام العميق للتقاليد الفنية الأوروبية. عقودٌ من التفاني في التفاصيل والجودة ألهمت فصلًا جديدًا: Le Petit Paradis.",
            "Lace Palace — a family business founded in 1955 in Belgium — built its reputation on exquisite lacework, timeless craftsmanship, and a deep respect for European artisanal tradition. Decades of dedication to detail and quality inspired a new chapter: Le Petit Paradis."
          )}
        </p>
      </Section>

      {/* The LPP Story */}
      <Section title={tr("قصة Le Petit Paradis", "The LPP Story")}>
        <p>
          {tr(
            "تأسّسنا على إرثٍ أوروبي غني من الحِرفية الخالدة. متجذّرون في بلجيكا — البلد المعروف بفنّه وتميّز تصميمه — نفخر بأننا الجيل الرابع الذي يحمل إرثًا من الجودة الاستثنائية، والتصميم الراقي، والحِرفية الدقيقة التي شكّلت الفخامة الأوروبية لأكثر من ستة عقود.",
            "Built on a rich European heritage of timeless craftsmanship. Rooted in Belgium — a country celebrated for its artistry and design excellence — we are proud to represent the fourth generation carrying forward a legacy of exceptional quality, sophisticated design, and meticulous craftsmanship that has shaped European luxury for more than six decades."
          )}
        </p>
        <p>
          {tr(
            "بدأت قصّتنا برؤية لصناعة ملابس أطفال فاخرة ومصنوعة يدويًا تعكس أناقة الحِرفية الأوروبية الحقيقية ورُقيّها. وانطلاقًا من النجاح الطويل لـ Lace Palace، وسّعنا حضورنا إلى منطقة الخليج، حيث يواصل Le Petit Paradis ازدهاره اليوم.",
            "Our story began with a vision to create luxurious, high-quality, handcrafted children's clothing that reflects the elegance and refinement of true European craftsmanship. Building on the long-standing success of Lace Palace, we expanded our presence to the Gulf, where Le Petit Paradis now continues to flourish."
          )}
        </p>
        <p>
          {tr(
            "في Le Petit Paradis، تُصاغ كل قطعة بعنايةٍ تكريمًا لأصولنا الأوروبية، مازجةً الفن البلجيكي الكلاسيكي بالتصميم العصري. قطعنا أكثر من مجرد ملابس — كل واحدةٍ منها تحفةٌ خالدة تروي قصة تفانٍ، وأصالة، والتزامٍ بالتميّز.",
            "At Le Petit Paradis, every garment is thoughtfully crafted to honour our European origins, blending classic Belgian artistry with modern design. Our pieces are more than clothing—each one is a timeless creation that tells a story of dedication, authenticity, and a commitment to excellence."
          )}
        </p>
        <p>
          {tr(
            "بصفتنا الجيل الرابع المؤتمن على إرث Lace Palace، نبقى ملتزمين بصون القيم التي شكّلت ماضينا، وفي الوقت نفسه نُصمّم قطعًا تُلهم المستقبل.",
            "As the fourth generation entrusted with the legacy of Lace Palace, we remain devoted to preserving the values that shaped our past while designing pieces that inspire the future."
          )}
        </p>
      </Section>

      {/* World of little wonders */}
      <Section title={tr("عالمٌ من العجائب الصغيرة", "A World of Little Wonders")}>
        <p>
          {tr(
            "في Le Petit Paradis، نؤمن بأن كل طفلة تستحق أن تتألّق في يومها المميّز. من حديثي الولادة وحتى عمر 12 عامًا، صُمِّمت مجموعاتنا بعناية لتجمع بين السحر، والأناقة، والراحة في كل تفصيل.",
            "At Le Petit Paradis, we believe every child deserves to shine on her special day. From newborns to 12-year-olds, our collections are thoughtfully crafted to blend charm, elegance, and comfort in every detail."
          )}
        </p>
        <p>
          {tr(
            "سواء كانت مناسبة عيد ميلاد، أو حفل زفاف، أو لمّةً عائلية، فإن كل إطلالة مصمَّمة لتمنح صغيرتكم شعورًا مميّزًا — لتحوّل اللحظات الجميلة إلى ذكرياتٍ لا تُنسى.",
            "Whether it's a birthday, wedding, or family celebration, each outfit is designed to make your little one feel special — transforming beautiful moments into unforgettable memories."
          )}
        </p>
        <p>
          <Link
            to="/category/$slug"
            params={{ slug: "new-in" }}
            className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-7 h-11 text-xs tracking-[0.18em] hover:opacity-90 transition shadow-soft mt-2"
          >
            {tr("تصفّحي مجموعاتنا الكاملة", "Browse our Complete Product Range")}
          </Link>
        </p>
      </Section>

      {/* Timeline */}
      <Section title={tr("الخط الزمني", "Timeline")}>
        <ol className="mt-2">
          <TimelineItem
            year="1955"
            title={tr("Lace Palace — بلجيكا", "Lace Palace — Belgium")}
            body={tr(
              "بدأت الرحلة مع Lace Palace، المتجذّرة في صناعة الدانتيل البلجيكي والرُقي الأوروبي. على مدى أجيال، أتقنّا الحِرفية والتصميم.",
              "The journey started with Lace Palace, rooted in Belgian lace-making and European refinement. For generations we perfected craftsmanship and design."
            )}
          />
          <TimelineItem
            year="1995"
            title={tr("Le Petit Paradis — بلجيكا وأوروبا", "Le Petit Paradis — Belgium & Europe")}
            body={tr(
              "استنادًا إلى ذلك الإرث، تأسّس Le Petit Paradis عام 1995، ليُقدّم ملابس أطفال فاخرة مصنوعة يدويًا مستوحاة من الفنّ البلجيكي الكلاسيكي.",
              "Drawing on that legacy, Le Petit Paradis was established in 1995, creating luxurious, handcrafted children's clothing inspired by classical Belgian artistry."
            )}
          />
          <TimelineItem
            year="2023"
            title={tr("الإمارات العربية المتحدة", "UAE")}
            body={tr(
              "في عام 2023، حملنا Le Petit Paradis إلى الإمارات، لنشارك تقاليد الأناقة والراحة مع العائلات العصرية في الشرق الأوسط.",
              "In 2023, we brought Le Petit Paradis to the UAE, sharing our tradition of elegance and comfort with modern Middle Eastern families."
            )}
          />
          <TimelineItem
            year="2024"
            title={tr("المملكة العربية السعودية", "KSA")}
            body={tr(
              "بحلول عام 2024، امتدّت قصّتنا إلى المملكة العربية السعودية، لنُوسّع التزامنا بالجودة والعناية في جميع أنحاء المنطقة.",
              "By 2024, our story continued into Saudi Arabia, extending our commitment to quality and care across the region."
            )}
          />
        </ol>
      </Section>
    </article>
  );
}
