import { emptySession } from './core.js';
// Original, hand-written synthetic teaching examples. No model generated these in a measured run.
export function demoSession(remember = false) {
  return { ...emptySession(), remember, synthetic: true,
    question: 'My downloads folder is a mess. How can I tidy it in 15 minutes without accidentally deleting something important?',
    inputs: [
      { origin: 'Synthetic example 1 — quick checklist', text: 'Set a 15-minute timer and aim for a first pass, not a perfect folder.\n\n1. Create a “Review later” folder. Move unfamiliar files there instead of deleting them.\n2. Sort Downloads by date. Move documents you recognize into a few folders, such as Work, Personal, and Receipts.\n3. Check large files individually. Delete only what you recognize and know you no longer need.\n4. Stop when the timer rings. Leave the trash alone until you’ve had time to check.\n\nMoving files is not a backup. Keep another copy of anything important before making major changes.' },
      { origin: 'Synthetic example 2 — general advice', text: 'A tidy downloads folder can make your computer easier to use. Begin by thinking about the types of files you usually download and choosing a naming system that suits you.\n\nOrganize files into sensible categories, rename unclear items, and remove things that are no longer necessary. Regular maintenance will help prevent clutter from building up again.\n\nBe careful with important documents and consider making a backup before deleting files. You do not need to finish everything in one sitting.' }
    ]
  };
}
