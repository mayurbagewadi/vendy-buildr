import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const sections = [
  {
    title: "1. Eligibility",
    body: "To qualify for this offer, the store owner's Instagram account must meet all of the following criteria at the time of review:",
    bullets: [
      "Minimum 1,000 followers",
      "Minimum 5,000 total views on the account",
      "Minimum 100 shares on each previous Reel",
      "Minimum 150 likes on each previous Reel",
      "Previous 10 Reels must average a minimum of 5,000 views per Reel",
    ],
  },
  {
    title: "2. Account Review",
    body: "After requesting the offer, DigitalDukandar.in will review the store owner's Instagram account against all eligibility criteria. If the account does not meet the required standards, the offer will be denied. Accounts found to be using fake followers, bots, engagement pods, or purchased engagement services will be disqualified immediately.",
  },
  {
    title: "3. Reel Obligation",
    body: "Upon activation of a paid plan, the store owner is required to create and publish one promotional Instagram Reel (45–60 seconds) promoting DigitalDukandar.in on their Instagram account. The promotional Reel must remain publicly visible on the store owner's Instagram account for a minimum of 1 year from the publishing date. Deleting or archiving the Reel within this period is a violation of these terms.",
  },
  {
    title: "4. Content Requirements",
    body: "DigitalDukandar.in will provide the store owner with specific talking points. The store owner must include all provided points in the Reel. Reels that do not include the required points will be rejected and the store owner must recreate the Reel. DigitalDukandar.in may reject any Reel containing misleading claims, offensive material, copyrighted music violations, or content deemed harmful to the reputation of DigitalDukandar.in.",
  },
  {
    title: "5. Approval Process",
    body: "Before publishing, the store owner must submit the Reel to DigitalDukandar.in for approval. The store owner may only publish the Reel after receiving written approval from DigitalDukandar.in. Publishing without approval is a violation of these terms.",
  },
  {
    title: "6. Publishing Deadline",
    body: "Once the Reel is approved by DigitalDukandar.in, the store owner must post it on their Instagram account within 2 days. Failure to publish within this period will result in cancellation of the active plan by DigitalDukandar.in.",
  },
  {
    title: "7. No Payment for Reel",
    body: "The store owner agrees to create and publish the promotional Reel at no cost to DigitalDukandar.in. The store owner shall not request, charge, or accept any form of payment from DigitalDukandar.in in exchange for creating or posting the Reel. The Reel is the store owner's obligation in exchange for the free website — not a paid service.",
  },
  {
    title: "8. Content Ownership & Usage Rights",
    bullets: [
      "The Reel is jointly owned by DigitalDukandar.in and the store owner.",
      "Both parties may use the content for promotional purposes.",
      "By claiming this offer, the store owner grants DigitalDukandar.in the right to use their brand name, logo, and product images for promotional purposes.",
      "The store owner grants DigitalDukandar.in a non-exclusive, royalty-free license to use, repost, edit, and promote the Reel across any marketing channels without further consent or compensation.",
    ],
  },
  {
    title: "9. Limitations",
    bullets: [
      "This is a one-time offer — valid only on the first paid plan purchase, not on renewals.",
      "This offer is non-transferable and cannot be claimed by another account.",
      "Limited to the first 50 store owners only.",
      "DigitalDukandar.in is not liable for delays caused by Instagram outages, platform restrictions, or any technical issues beyond our control.",
    ],
  },
  {
    title: "10. No Results Guarantee",
    body: "DigitalDukandar.in guarantees the free website — not the outcome of the Reel. Views, likes, shares, sales, or follower growth resulting from the post are not guaranteed.",
  },
  {
    title: "11. Enforcement",
    body: "Violation of any of these terms may result in immediate suspension or cancellation of the offer and active plan without compensation.",
  },
  {
    title: "12. Modifications",
    body: "DigitalDukandar.in reserves the right to modify these terms at any time without prior notice. Continued use of the offer following any modification constitutes acceptance of the updated terms.",
  },
];

interface Props {
  /** Pass a className to override the default trigger style */
  triggerClassName?: string;
}

export const InstagramPromoTermsModal = ({ triggerClassName }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "text-xs text-white/50 hover:text-white/70 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0"
        }
      >
        *Terms &amp; conditions apply
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold leading-snug pr-6">
              DigitalDukandar.in Free Website Promotional Offer — Terms &amp; Conditions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="font-semibold text-foreground mb-1">{section.title}</p>
                {section.body && <p>{section.body}</p>}
                {section.bullets && (
                  <ul className="mt-1.5 space-y-1 list-disc list-inside">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
