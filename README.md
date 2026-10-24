# RationSaathi

RationSaathi is a local-first comparison tool for user-entered public distribution entitlement rules and recorded household deliveries. It keeps source evidence beside the arithmetic and prepares a neutral report.

## Open the app

Open index.html in a current browser. There is no build step, package install, account, or server requirement.

## Use it

1. Enter the household member count, comparison dates, and number of entitlement periods covered.
2. Add one entitlement rule per item. Enter the quantity per member per period, choose a unit, and name the source for the rule.
3. Add each delivery as its own record, with its date and receipt reference, note, or pasted receipt text. Partial visits are summed.
4. Review the quantities and source details in the report. Copy it, print it, or export a JSON copy.

Quantity values accept up to three decimal places. Calculations use integer thousandths internally, so sums and differences do not use floating-point rounding. The report shows the entitlement multiplication, each delivery, the total recorded received, and any shortfall for every item.

The optional receipt helper is a local pattern matcher. It can suggest quantities that include a matching unit and dates in YYYY-MM-DD or DD/MM/YYYY form. Suggestions are not applied until a person selects them, and the person still saves each delivery record.

## Publish with GitHub Pages

The app is a static site. In the repository, open Settings > Pages, choose Deploy from a branch, select the main branch and the root folder, then save. GitHub Pages will serve the root index.html. The site URL is usually https://OWNER.github.io/REPOSITORY/.

## Data and scope

Entries are stored in this browser's local storage on this device. The app does not send comparison data to a server. Exported JSON contains the comparison and report text; share it only when appropriate. Clearing browser data removes the saved comparison.

The app applies only the rules the user enters. It does not infer other entitlements, determine what stock was available, or identify the cause of a difference. A recorded shortfall is a quantity comparison and is not evidence of wrongdoing.
