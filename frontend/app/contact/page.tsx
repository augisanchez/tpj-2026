import Link from "next/link";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/ContactPage.module.css";

export const metadata = {
  title: "Contact — The Photographic Journal",
  description:
    "Get in touch with The Photographic Journal — submissions, advertising, press, and general inquiries.",
};

type Channel = {
  label: string;
  description: string;
  /** Either an email address (renders as a mailto link) or a route href. */
  href: string;
  /** Display text for the link. Defaults to the href value. */
  display?: string;
};

const CHANNELS: Channel[] = [
  {
    label: "Submissions",
    description:
      "Would you like to be published in TPJ? Send us pix, let us kibbitz, make some magic. Read the guidelines before you send.",
    href: "/submit",
    display: "Read the submissions guidelines →",
  },
  {
    label: "Advertising",
    description:
      "Want to work with TPJ? We are always on the lookout for companies and brands to collaborate with. Hit us up.",
    href: "mailto:opportunities@thephotographicjournal.com",
    display: "opportunities@thephotographicjournal.com",
  },
  {
    label: "Press",
    description:
      "For journalists looking for more information on TPJ — our likes, our dislikes, our dream date, our favorite foods, our shoe sizes — write us here.",
    href: "mailto:press@thephotographicjournal.com",
    display: "press@thephotographicjournal.com",
  },
  {
    label: "General",
    description:
      "For all other inquiries — recipes, questions about the universe, love advice — please email us.",
    href: "mailto:info@thephotographicjournal.com",
    display: "info@thephotographicjournal.com",
  },
];

export default function ContactPage() {
  return (
    <>
      <SupportingPageBanner title="Contact">
        <p>
          Collaborators and co-conspirators wanted.
        </p>
      </SupportingPageBanner>

      <main className={styles.page}>
        <ol className={styles.channels}>
          {CHANNELS.map((channel) => {
            const Tag = channel.href.startsWith("/") ? Link : "a";
            const linkProps = channel.href.startsWith("/")
              ? { href: channel.href }
              : { href: channel.href };
            return (
              <li key={channel.label} className={styles.channel}>
                <div className={styles.channelText}>
                  <p className={styles.channelLabel}>{channel.label}</p>
                  <p className={styles.channelDescription}>
                    {channel.description}
                  </p>
                  <Tag {...linkProps} className={styles.channelLink}>
                    {channel.display ?? channel.href}
                  </Tag>
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
