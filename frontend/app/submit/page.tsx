import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/SubmitPage.module.css";

export const metadata = {
  title: "Submit — The Photographic Journal",
  description:
    "How to submit your photo essay to The Photographic Journal.",
};

const GUIDELINES: { title: string; detail?: string }[] = [
  {
    title: "Any theme you like.",
    detail:
      "We avoid trying to constrain our photographers’ process too much, but we do prefer work that has a strong POV, a good deal of energy in the subjects and settings, and are especially fond of photos which strongly convey emotion and/or thematic subtext.",
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
    detail: "May be edited by staff.",
  },
  {
    title: "A title.",
    detail: "May also be edited by staff.",
  },
  {
    title: "A profile picture.",
  },
  {
    title:
      "We reserve the right to reject the photo essay any time before publication.",
  },
];

export default function SubmitPage() {
  return (
    <>
      <SupportingPageBanner title="Submit">
        <p>
          Submissions are always open. We accept photo essays of all shapes
          and sizes.
        </p>
      </SupportingPageBanner>

      <main className={styles.page}>
        <section className={styles.pitch}>
          <h2 className={styles.pitchHeading}>
            Would you like to be published in TPJ?
            <br />
            Send us pix, let us kibbitz, make some magic.
          </h2>
          <p className={styles.paragraph}>
            We are always reading. If you have a body of work you think
            belongs in TPJ, we want to see it. Read the guidelines below
            before sending so that your essay arrives in the format we can
            review the fastest.
          </p>
        </section>

        <aside className={styles.howTo}>
          <p className={styles.howToEyebrow}>How to send</p>
          <p className={styles.howToBody}>
            Send your essay via WeTransfer to:
          </p>
          <a
            className={styles.howToEmail}
            href="mailto:submissions@thephotographicjournal.com"
          >
            submissions@thephotographicjournal.com
          </a>
        </aside>

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

        <section className={styles.closing}>
          <p className={styles.closingHeadline}>
            Submissions are always open. Send us something that expresses
            who you are as loudly and wonderfully as possible.
          </p>
          <p className={styles.closingHeart}>We love you.</p>
        </section>
      </main>
    </>
  );
}
