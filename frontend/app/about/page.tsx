import { pageMetadata } from "@/lib/seo";
import { SupportingPageBanner } from "@/components/SupportingPageBanner";
import styles from "@/components/AboutPage.module.css";

export const metadata = pageMetadata({
    generatedImage: true,
  title: "About — The Photographic Journal",
  description: "About The Photographic Journal: editorial mission and the team behind the publication.",
  path: "/about",
});

// Personal sites as linked on the v1 About page (checked Nov 2026).
// Paige Mauriello's old site no longer resolves; Sally Reynolds had none.
const TEAM: { name: string; role: string; url?: string }[] = [
  { name: "Agustin Sanchez", role: "Founder, Publisher", url: "https://www.agustin-sanchez.com/" },
  { name: "Lou Noble", role: "Editor-In-Chief", url: "https://www.louobedlam.com/" },
  { name: "SuzAnne Steben", role: "Managing Editor", url: "http://www.suzannesteben.com/" },
  { name: "Paige Mauriello", role: "Essays Editor" },
  { name: "Asa Featherstone, IV", role: "Contributing Editor", url: "https://www.asafeatherstone.com/" },
  { name: "Sally Reynolds", role: "Contributing Editor" },
  {
    name: "Kate Sweeney",
    role: "Staff Photographer · Photographer-in-Residence (2016–2019)",
    url: "https://www.katesweeneyphotography.com/",
  },
  { name: "Jason Travis", role: "Photographer-in-Residence (2020)", url: "http://www.jasontravisphoto.com/" },
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

      <div className={styles.page}>
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
          <img src="/about/team.jpg" alt="The TPJ team" width={1600} height={1211} loading="lazy" decoding="async" data-fade="" />
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
                <h3 className={styles.memberName}>
                  {member.url ? (
                    <a href={member.url} target="_blank" rel="noopener noreferrer" className={styles.memberLink}>
                      {member.name}
                      <span className={styles.srOnly}> (opens in a new tab)</span>
                    </a>
                  ) : (
                    member.name
                  )}
                </h3>
                <p className={styles.memberRole}>{member.role}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
