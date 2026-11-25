import { pageMetadata } from "@/lib/seo";
import { SubmissionForm } from "@/components/SubmissionForm";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/SubmitPage.module.css";

export const metadata = pageMetadata({
    generatedImage: true,
  title: "Submit — The Photographic Journal",
  description: "How to submit your photo essay to The Photographic Journal.",
  path: "/submit",
});

type Guideline = { title: string; detail?: string };

/* Requirements in three boxed sections. Headings and titles are the
   site's copy; the descriptions marked DRAFT are new and need Lou's ear. */
const GUIDELINE_GROUPS: {
  heading: string;
  items: Guideline[];
}[] = [
  {
    heading: "Photo essays",
    items: [
      {
        title: "Photo essays only.",
        detail:
          "We publish photography, not writing. Essays that are mostly text, criticism, or commentary aren’t a fit, even if they include images.",
      },
      {
        title: "Any theme you like.",
        detail:
          "We try not to box in our photographers, but we do love work with a strong POV, real energy in its subjects and settings, and photos that carry emotion or some kind of thematic undercurrent.",
      },
      {
        title: "A narrative or thematic connection across the images.",
        // DRAFT
        detail:
          "The photographs should talk to each other. A story, a mood, a question you keep circling back to. Show us the thread.",
      },
    ],
  },
  {
    heading: "Support your essay",
    items: [
      {
        title: "A title.",
        // DRAFT (second sentence is the existing copy)
        detail: "Something short that sounds like the work. We may tweak that too.",
      },
      {
        title: "An intro of no more than 200 words.",
        // DRAFT (last sentence is the existing copy)
        detail:
          "Tell us what we’re looking at and why it matters to you. Keep it tight. We may tighten it up.",
      },
    ],
  },
  {
    heading: "Images",
    items: [
      {
        title: "Between 10 and 20 images.",
        // DRAFT
        detail: "Enough to tell the story, few enough that every frame earns its place. Edit hard.",
      },
      {
        title: "1800 to 2400 pixels wide at 72 dpi.",
        // DRAFT
        detail: "Big enough to look sharp on a large screen, light enough to load fast on a phone.",
      },
    ],
  },
];

/* Not a requirement, so it sits under the sections as a closing note. */
const FINE_PRINT: Guideline = {
  title: "We reserve the right to reject any essay before publication.",
  detail: "It happens, and it’s nothing personal.",
};

export default function SubmitPage() {
  return (
    <>
      <SupportingPageBanner
        title="Submissions"
        titleClassName={styles.bannerTitle}
      >
        <p>
          We’re always reading. Send us photo essays of all shapes and
          sizes.
        </p>
      </SupportingPageBanner>

      <div className={styles.page}>
        <section className={styles.pitch}>
          <h2 className={styles.pitchHeading}>
            Would you like to be published in TPJ? Send us pix, let us
            kibbitz, make some magic.
          </h2>
          <p className={styles.paragraph}>
            If you’ve got a body of work you think belongs here, we want
            to see it. Have a quick look at the guidelines first so your
            essay lands in our laps the way we can review it fastest.
          </p>
          <p className={styles.paragraph}>
            Send us something that sounds like you. The louder and
            stranger and more itself, the better.
          </p>
          <p className={styles.paragraph}>We love you.</p>
        </section>

        <header className={styles.guidelinesHeading}>
          <p className={styles.guidelinesEyebrow}>Guidelines</p>
          <h2 className={styles.guidelinesTitle}>
            What to include in a submission
          </h2>
        </header>

        <div className={styles.guidelines}>
          {GUIDELINE_GROUPS.map((group) => {
            const headingId = `guidelines-${group.heading
              .toLowerCase()
              .replace(/\s+/g, "-")}`;
            return (
              <section
                key={group.heading}
                aria-labelledby={headingId}
                className={styles.group}
              >
                <h3 id={headingId} className={styles.groupHeading}>
                  {group.heading}
                </h3>
                <ul className={styles.groupList}>
                  {group.items.map((item) => (
                    <li key={item.title} className={styles.guideline}>
                      <p className={styles.guidelineHeadline}>{item.title}</p>
                      {item.detail && (
                        <p className={styles.guidelineDetail}>{item.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className={styles.finePrint}>
            <p className={styles.finePrintLead}>{FINE_PRINT.title}</p>
            <p className={styles.finePrintDetail}>{FINE_PRINT.detail}</p>
          </div>
        </div>

        <SubmissionForm />
      </div>
    </>
  );
}
