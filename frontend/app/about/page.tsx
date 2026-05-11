import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/AboutPage.module.css";

export const metadata = {
  title: "About — The Photographic Journal",
  description:
    "About The Photographic Journal: editorial mission and the team behind the publication.",
};

const TEAM = [
  { name: "Agustin Sanchez", role: "Founder, Publisher" },
  { name: "Lou Noble", role: "Editor-In-Chief" },
  { name: "SuzAnne Steben", role: "Managing Editor" },
  { name: "Paige Mauriello", role: "Essays Editor" },
  { name: "Asa Featherstone, IV", role: "Contributing Editor" },
  { name: "Sally Reynolds", role: "Contributing Editor" },
  {
    name: "Kate Sweeney",
    role: "Staff Photographer · Photographer-in-Residence (2016–2019)",
  },
  { name: "Jason Travis", role: "Photographer-in-Residence (2020)" },
];

export default function AboutPage() {
  return (
    <>
      <SupportingPageBanner title="About">
        <p>
          The Photographic Journal is an online editorial publication for
          photographers, founded in 2012.
        </p>
        <p>
          We publish long-form essays, interviews, and features from
          photographers around the world.
        </p>
        <p>
          Edited from Los Angeles.
          <br />
          Published from Miami.
          <br />
          Read globally.
        </p>
      </SupportingPageBanner>

      <main className={styles.page}>
        <section className={styles.mission}>
          <h2 className={styles.missionHeading}>
            Entranced by photography since 2012.
          </h2>
          <p className={styles.lede}>
            When we founded The Photographic Journal in 2012 we had a single
            purpose: to chat with the photographers we love, climb into their
            brains, and figure out what makes them tick.
          </p>
        </section>

        <div className={styles.teamImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about/team.png" alt="The TPJ team" />
        </div>

        <section className={styles.mission}>
          <p className={styles.paragraph}>
            Over the years, we&rsquo;ve expanded beyond that original aim, as
            we&rsquo;ve come into contact with more and more talented people.
            Today we serve as a platform where photographers of all levels
            can explore the medium they love. We publish boundary-pushing
            images that make us feel more connected on a human level, and we
            strive to help our creative community better serve each other as
            mutual sources of inspiration.
          </p>
          <p className={styles.paragraph}>
            The idea behind TPJ is simple: we are entranced by photography.
            We get a real and genuine thrill out of exploring the booming
            landscape of the medium, and in the process, we offer a place
            where the newest and most creative voices can be heard.
          </p>
        </section>

        <div className={styles.divider} aria-hidden="true" />

        <section>
          <div className={styles.teamGrid}>
            {TEAM.map((member) => (
              <article key={member.name} className={styles.member}>
                <h3 className={styles.memberName}>{member.name}</h3>
                <p className={styles.memberRole}>{member.role}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
