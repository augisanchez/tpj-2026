import { SubmissionForm } from "@/components/SubmissionForm";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/SubmitPage.module.css";

export const metadata = {
  title: "Submit — The Photographic Journal",
  description:
    "How to submit your photo essay to The Photographic Journal.",
};

const GUIDELINES: { title: string; detail?: string }[] = [
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
  },
  {
    title: "Between 10 and 20 images.",
  },
  {
    title: "1800 to 2400 pixels wide at 72 dpi.",
  },
  {
    title: "An intro of no more than 200 words.",
    detail: "We may tighten it up.",
  },
  {
    title: "A title.",
    detail: "We may tweak that too.",
  },
  {
    title: "We reserve the right to reject any essay before publication.",
    detail: "It happens, and it’s nothing personal.",
  },
];

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

      <main className={styles.page}>
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

        <ol className={styles.guidelinesList}>
          {GUIDELINES.map((item) => (
            <li key={item.title} className={styles.guideline}>
              <div className={styles.guidelineText}>
                <p className={styles.guidelineHeadline}>{item.title}</p>
                {item.detail && (
                  <p className={styles.guidelineDetail}>{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <SubmissionForm />
      </main>
    </>
  );
}
