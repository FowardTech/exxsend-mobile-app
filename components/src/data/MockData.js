export const accounts = [
  { code: "CAD", label: "CAD balance", amount: "0.00", flag: "🇨🇦" },
  { code: "NGN", label: "NGN balance", amount: "11,795.00", flag: "🇳🇬" },
];

export const recents = [
  { initials: "AKB", name: "Ayotunde B", bank: "Access\nBank Nigeria", flag: "🇳🇬" },
  { initials: "AKH", name: "Akande H", bank: "First City\nMonument Bank", flag: "🇳🇬" },
  { initials: "AB", name: "Ayotunde B", bank: "", flag: "🇨🇦" },
];

export const cadWalletTx = [
  {
    date: "Dec 25, 2025",
    items: [
      { title: "CAD → NGN Conversion", time: "12:44 PM", right: "-25.00 CAD", subRight: "-26,525.00 NGN" },
      { title: "Topup via Interac", time: "12:44 PM", right: "+25.00 CAD", subRight: "" },
    ],
  },
  {
    date: "Dec 23, 2025",
    items: [
      { title: "CAD → NGN Conversion", time: "5:19 AM", right: "-200.00 CAD", subRight: "-211,000.00 NGN" },
    ],
  },
];

export const allTx = [
  {
    date: "Dec 25, 2025",
    items: [
      { leftIcon: "↑", title: "To Onyedikachukwu U...", time: "12:45 PM", right: "-100,000.00 NGN" },
      { leftIcon: "+", title: "NGN Exchange Funding", time: "12:44 PM", right: "+26,525.00 NGN" },
      { leftIcon: "💱", title: "CAD → NGN Conversion", time: "12:44 PM", right: "-25.00 CAD", subRight: "-26,525.00 NGN" },
      { leftIcon: "🅸", title: "Topup via Interac", time: "12:44 PM", right: "+25.00 CAD" },
    ],
  },
  {
    date: "Dec 23, 2025",
    items: [
      { leftIcon: "↑", title: "To Adeola Yemisi Kehin...", time: "5:20 AM", right: "-211,000.00 NGN" },
      { leftIcon: "+", title: "NGN Exchange Funding", time: "5:19 AM", right: "+211,000.00 NGN" },
    ],
  },
];
export const recentRecipients = [
  { id: "r1", initials: "AH", name: "Akande...", bankShort: "First City..." },
  { id: "r2", initials: "AB", name: "Ayotund...", bankShort: "Access B..." },
  { id: "r3", initials: "BS", name: "Balogun...", bankShort: "Ecobank..." },
  { id: "r4", initials: "AK", name: "Adeola Y...", bankShort: "Gtbank P..." },
];

export const savedRecipients = [
  { id: "s1", initials: "AY", name: "Adeola Yemisi Kehinde", bankFull: "Gtbank PLC", account: "0019824708" },
  { id: "s2", initials: "AK", name: "Akande Kehinde Helen", bankFull: "First City Monument Bank", account: "2682229017" },
  { id: "s3", initials: "AO", name: "Alafia David Ojo", bankFull: "Opay", account: "9066906024" },
  { id: "s4", initials: "AA", name: "Aslclient Account", bankFull: "Gtbank PLC", account: "0221207003" },
];

export const banks = [
  "Access Bank Nigeria",
  "First City Monument Bank",
  "GTBank PLC",
  "Zenith Bank",
  "UBA",
  "Opay",
];
