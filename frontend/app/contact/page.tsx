import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/ContactPage.module.css";

export const metadata = {
  title: "Contact — The Photographic Journal",
  description:
    "Get in touch with The Photographic Journal for advertising, press, and general inquiries.",
};

export default function ContactPage() {
  return (
    <>
      <SupportingPageBanner title="Contact">
        <p>Collaborators and co-conspirators wanted.</p>
      </SupportingPageBanner>

      <main className={styles.page}>
        <section className={styles.pitch}>
          <h2 className={styles.pitchHeading}>Drop us a line.</h2>
          <p className={styles.lede}>
            Want to advertise with us? Got a press inquiry? Have a love
            advice question or a recipe to share? Pick a topic and tell
            us what’s up.
          </p>
          <p className={styles.note}>
            Looking to submit a photo essay?{" "}
            <Link href="/submit" className={styles.noteLink}>
              Head to the submissions page
            </Link>{" "}
            instead.
          </p>
        </section>

        <ContactForm />
      </main>
    </>
  );
}
