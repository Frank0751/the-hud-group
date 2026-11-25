/* Shared details for the TSF 2026 graduation and TSF 2027 induction materials.
   Change a date, time or name HERE and the invitation, programme and welcome pack all pick it up.
   Everything below follows "TSF 2027: Roadmap to Induction and Graduation" (21 November 2026) and is a proposal
   until the team agrees it. */
window.TSF_EVENT = {
  ceremonyTitle: 'Graduation and Induction Ceremony',
  theme: 'Faithful in Babylon. Sent to make disciples.',
  day: 'Saturday',
  dateShort: '26',
  monthYear: 'December 2026',
  ceremonyDate: 'Saturday 26 December 2026',
  ceremonyTime: '6:00 to 8:00 PM GMT',
  platform: 'Online on Zoom',
  joinNote: 'For the joining link, email engage@thehudgroupglobal.org',
  timezones: '6:00 PM Accra · 7:00 PM Lagos and Douala · 8:00 PM Maseru · 9:00 PM Nairobi · 1:00 PM Montreal',
  graduatingCohort: 'TSF 2026',
  newCohort: 'TSF 2027',

  orientation: 'Tuesday 29 December 2026, 7:00 PM GMT, online (60 minutes)',
  week1: 'Friday 1 January 2027',
  sessionTime: 'Fridays, 7:00 PM GMT',
  portal: 'the-hud-group.vercel.app/portal',
  email: 'engage@thehudgroupglobal.org',

  /* Names for the programme. Leave empty until the lists are confirmed: the names page is left out while both are empty.
     Spell each name as the person wants it printed. */
  graduates: [],
  tsfxGraduates: [],
  inductees: [],

  /* Order of the evening (times in GMT). "who" is printed as written: use a role until a person is confirmed. */
  runOfShow: [
    ['5:45', 'Gathering', 'Worship music and a look back at the TSF 2026 year', ''],
    ['6:00', 'Welcome and purpose', 'The HuD Group, The Shadrach Fellowship and the two reasons we gather tonight', 'Frank Koomson, MC'],
    ['6:05', 'Opening prayer', '', 'A TSF 2025 graduate'],
    ['6:08', 'Scripture and reflection', 'Daniel 3:16 to 18 and Matthew 28:18 to 20', 'Dr. Yaw Perbi'],
    ['6:16', 'The year in numbers', 'Sessions, attendance, Bible in One Year, disciples and Hi 5 groups', 'Frank Koomson'],
    ['6:20', 'Highlight video', 'TSF 2026 in eight minutes', ''],
    ['6:28', 'Reflections from the graduates', 'Spiritual, missional, leadership and communal formation', 'Four graduates'],
    ['6:43', 'TSF 2026 Awards', '', 'Frank Koomson'],
    ['6:53', 'Presentation of certificates', '', 'Dr. Yaw Perbi and Frank Koomson'],
    ['7:05', 'Charge and blessing to the graduates', '', 'Dr. Yaw Perbi'],
    ['7:15', 'Passing the baton', 'A graduate welcomes the new cohort', 'A TSF 2026 graduate'],
    ['7:18', 'Introducing TSF 2027', 'Core fellows, TSFx mentees and associates', 'Frank Koomson'],
    ['7:28', 'The journey ahead', 'The 2027 roadmap and the weekly rhythm', 'Dr. Yaw Perbi'],
    ['7:33', 'Induction prayer and blessing', 'Welcoming the TSF 2027 cohort', 'Dr. Yaw Perbi'],
    ['7:41', 'Prayer for TSF and The HuD Group', 'Fellows, leaders and global missions', 'A HuD Group leader'],
    ['7:45', 'Special remarks', '', 'HuD Group leadership'],
    ['7:49', 'Announcements', 'Orientation, Week 1, the 21-day fast, the Fellows Portal and giving', 'Frank Koomson'],
    ['7:54', 'Closing remarks', 'Thanks to facilitators, mentors, volunteers and families', 'Dr. Yaw Perbi'],
    ['7:58', 'Closing prayer and benediction', 'Group photo', '']
  ],

  awards: ['Most Consistent Fellow', 'Bible in One Year Completion', 'Disciple-Maker Award', 'Most Improved Fellow', 'Most Inspiring Fellow'],

  /* Welcome pack: the first weeks of 2027 (from the portal's starter roadmap). */
  firstWeeks: [
    ['Fri 1 Jan', 'Week 1 (Discovery Bible Study 1). Bible in One Year day 1. The 21-day fast begins.'],
    ['Fri 8 Jan', 'Week 2 (DBS 2). Write your first weekly reflection in the Fellows Portal.'],
    ['Fri 15 Jan', 'Week 3 (DBS 3). Start your prayer calendar.'],
    ['Thu 21 Jan', 'The 21-day fast ends.'],
    ['Fri 22 Jan', 'Week 4 (Purpose Statement 1).'],
    ['Fri 29 Jan', 'Your three disciples chosen and your prayer calendar filled.'],
    ['Fri 26 Feb', 'Hi 5 prayer group formed and an unreached people group adopted.']
  ]
};

/* Fills every element marked data-ev="key" with that value. */
document.addEventListener('DOMContentLoaded', function () {
  var E = window.TSF_EVENT;
  Array.prototype.forEach.call(document.querySelectorAll('[data-ev]'), function (el) {
    var v = E[el.getAttribute('data-ev')];
    if (typeof v === 'string') { el.textContent = v; }
  });
});
