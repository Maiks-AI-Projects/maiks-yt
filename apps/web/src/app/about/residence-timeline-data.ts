export type ResidenceTimelineEntry = {
  date: string;
  dateTime: string;
  description: string;
  id: string;
  title: string;
  year: number;
};

export const residenceTimeline: readonly ResidenceTimelineEntry[] = [
  {
    date: "3 September 1993",
    dateTime: "1993-09-03",
    description: "The earliest residence entry currently visible in the government record.",
    id: "residence-vlijmen-1993",
    title: "Registered in Vlijmen",
    year: 1993
  },
  {
    date: "1 November 1996",
    dateTime: "1996-11-01",
    description: "The registered residence changed within Vlijmen.",
    id: "residence-vlijmen-1996",
    title: "A different home in Vlijmen",
    year: 1996
  },
  {
    date: "3 November 1999",
    dateTime: "1999-11-03",
    description: "The registered residence changed to Esch.",
    id: "residence-esch-1999",
    title: "Moved to Esch",
    year: 1999
  },
  {
    date: "20 April 2000",
    dateTime: "2000-04-20",
    description: "The registered residence changed to Haaren.",
    id: "residence-haaren-2000",
    title: "Moved to Haaren",
    year: 2000
  },
  {
    date: "11 September 2000",
    dateTime: "2000-09-11",
    description: "The registered residence changed to Vught.",
    id: "residence-vught-2000",
    title: "Moved to Vught",
    year: 2000
  },
  {
    date: "18 December 2001",
    dateTime: "2001-12-18",
    description: "The registered residence changed to Haaren.",
    id: "residence-haaren-2001",
    title: "Moved to Haaren",
    year: 2001
  },
  {
    date: "17 April 2002",
    dateTime: "2002-04-17",
    description: "The registered residence changed to Vught.",
    id: "residence-vught-2002",
    title: "Moved to Vught",
    year: 2002
  },
  {
    date: "6 August 2003",
    dateTime: "2003-08-06",
    description: "The registered residence changed to Haaren.",
    id: "residence-haaren-2003",
    title: "Moved to Haaren",
    year: 2003
  },
  {
    date: "19 September 2003",
    dateTime: "2003-09-19",
    description: "The registered residence changed to Vught.",
    id: "residence-vught-2003",
    title: "Moved to Vught",
    year: 2003
  },
  {
    date: "8 January 2004",
    dateTime: "2004-01-08",
    description: "The registered residence changed to Haaren.",
    id: "residence-haaren-2004",
    title: "Moved to Haaren",
    year: 2004
  },
  {
    date: "20 April 2004",
    dateTime: "2004-04-20",
    description: "The registered residence changed to Schijndel.",
    id: "residence-schijndel-2004",
    title: "Moved to Schijndel",
    year: 2004
  },
  {
    date: "4 April 2005",
    dateTime: "2005-04-04",
    description: "The registered residence changed to Vught.",
    id: "residence-vught-2005",
    title: "Moved to Vught",
    year: 2005
  },
  {
    date: "4 October 2005",
    dateTime: "2005-10-04",
    description: "A Schijndel address was registered and later became the formal residential address.",
    id: "residence-schijndel-2005",
    title: "Registered in Schijndel",
    year: 2005
  },
  {
    date: "29 February 2008",
    dateTime: "2008-02-29",
    description: "The registered residence changed to Sint-Michielsgestel.",
    id: "residence-sint-michielsgestel-2008",
    title: "Moved to Sint-Michielsgestel",
    year: 2008
  },
  {
    date: "30 July 2009",
    dateTime: "2009-07-30",
    description: "The registered residence changed to Helvoirt.",
    id: "residence-helvoirt-2009",
    title: "Moved to Helvoirt",
    year: 2009
  },
  {
    date: "19 March 2010",
    dateTime: "2010-03-19",
    description: "The registered residence changed to Schijndel.",
    id: "residence-schijndel-2010",
    title: "Moved to Schijndel",
    year: 2010
  },
  {
    date: "6 February 2013",
    dateTime: "2013-02-06",
    description: "The registered residence changed to Haaren.",
    id: "residence-haaren-2013",
    title: "Moved to Haaren",
    year: 2013
  },
  {
    date: "16 November 2015",
    dateTime: "2015-11-16",
    description: "The registered residence changed to Boxtel.",
    id: "residence-boxtel-2015",
    title: "Moved to Boxtel",
    year: 2015
  },
  {
    date: "2 January 2019",
    dateTime: "2019-01-02",
    description: "The registered residence changed to Esch.",
    id: "residence-esch-2019",
    title: "Moved to Esch",
    year: 2019
  },
  {
    date: "16 June 2020",
    dateTime: "2020-06-16",
    description: "The registered residence changed to Boxtel.",
    id: "residence-boxtel-2020",
    title: "Moved to Boxtel",
    year: 2020
  }
] as const;
