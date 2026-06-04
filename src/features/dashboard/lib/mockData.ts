import { addDays, addHours, startOfDay, subDays } from "date-fns";

const today = startOfDay(new Date());

export const mockTodaysAttendances = [
	{
		id: 1,
		memberName: "Kevin Mwangi",
		image: "https://i.pravatar.cc/150?u=kevin",
		checkInTime: addHours(today, 6), // 6:00 AM
	},
	{
		id: 2,
		memberName: "Aisha Abdalla",
		image: "https://i.pravatar.cc/150?u=aisha",
		checkInTime: addHours(today, 6.75), // 6:45 AM
	},
	{
		id: 3,
		memberName: "Brian Otieno",
		image: "https://i.pravatar.cc/150?u=brian",
		checkInTime: addHours(today, 8.5), // 8:30 AM
	},
	{
		id: 4,
		memberName: "Grace Wambui",
		image: "https://i.pravatar.cc/150?u=grace",
		checkInTime: addHours(today, 9.25), // 9:15 AM
	},
	{
		id: 5,
		memberName: "John Kihara",
		image: "https://i.pravatar.cc/150?u=john",
		checkInTime: addHours(today, 10), // 10:00 AM
	},
	{
		id: 6,
		memberName: "Linet Akinyi",
		image: "https://i.pravatar.cc/150?u=linet",
		checkInTime: addHours(today, 11.5), // 11:30 AM
	},
	{
		id: 7,
		memberName: "Mark Weins",
		image: "https://i.pravatar.cc/150?u=mark",
		checkInTime: addHours(today, 12.75), // 12:45 PM
	},
	{
		id: 8,
		memberName: "Charity Musembi",
		image: "https://i.pravatar.cc/150?u=charity",
		checkInTime: addHours(today, 14.25), // 2:15 PM
	},
	{
		id: 9,
		memberName: "Dennis Kiptoo",
		image: "https://i.pravatar.cc/150?u=dennis",
		checkInTime: addHours(today, 16.5), // 4:30 PM
	},
	{
		id: 10,
		memberName: "Faith Njeri",
		image: "https://i.pravatar.cc/150?u=faith",
		checkInTime: addHours(today, 18), // 6:00 PM
	},
];

// Sorted by endDate descending (latest dates first)
export const mockExpiringMemberships = [
	{
		id: "mm_exp_2",
		memberName: "Grace Wambui",
		planName: "Monthly Gym Access",
		contact: "0712000004",
		image: "https://i.pravatar.cc/150?u=grace",
		endDate: addDays(today, 5),
	},
	{
		id: "mm_exp_4",
		memberName: "Mark Weins",
		planName: "Monthly Gym Access",
		contact: "0712000007",
		image: "https://i.pravatar.cc/150?u=mark",
		endDate: addDays(today, 3),
	},
	{
		id: "mm_exp_1",
		memberName: "Kevin Mwangi",
		planName: "Monthly Gym Access",
		contact: "0712000001",
		image: "https://i.pravatar.cc/150?u=kevin",
		endDate: addDays(today, 2),
	},
	{
		id: "mm_exp_3",
		memberName: "John Kihara",
		planName: "Annual Gym + Pool",
		contact: "0712000005",
		image: "https://i.pravatar.cc/150?u=john",
		endDate: addDays(today, 1),
	},
	{
		id: "mm_exp_5",
		memberName: "Linet Akinyi",
		planName: "10-Session PT Pack",
		contact: "0712000006",
		image: "https://i.pravatar.cc/150?u=linet",
		endDate: subDays(today, 1),
	},
	{
		id: "mm_exp_6",
		memberName: "Brian Otieno",
		planName: "Annual Gym + Pool",
		contact: "0712000003",
		image: "https://i.pravatar.cc/150?u=brian",
		endDate: subDays(today, 4),
	},
];

export const mockAverageAttendanceByDay = [
	{
		day: "Monday",
		attendance: 45,
		fill: "var(--chart-2)",
	},
	{
		day: "Tuesday",
		attendance: 52,
		fill: "var(--chart-2)",
	},
	{
		day: "Wednesday",
		attendance: 48,
		fill: "var(--chart-2)",
	},
	{
		day: "Thursday",
		attendance: 58,
		fill: "var(--chart-2)",
	},
	{
		day: "Friday",
		attendance: 62,
		fill: "var(--chart-2)",
	},
	{
		day: "Saturday",
		attendance: 75,
		fill: "var(--chart-2)",
	},
	{
		day: "Sunday",
		attendance: 35,
		fill: "var(--chart-2)",
	},
];
