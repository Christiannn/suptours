export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export type BookingBookable = {
	id: string;
	name: string;
	seats: number;
	schedule: Record<Weekday, string[]>;
};

export type BookingConfig = {
	bookables: BookingBookable[];
};

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
	bookables: [
		{
			id: 'hairdresser-lucy',
			name: 'Hairdresser 1 Lucy',
			seats: 3,
			schedule: {
				monday: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'],
				tuesday: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'],
				wednesday: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'],
				thursday: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'],
				friday: ['09:00', '10:00', '11:00', '12:00', '13:00']
			}
		},
		{
			id: 'hairdresser-finn',
			name: 'Hairdresser 2 Finn',
			seats: 1,
			schedule: {
				monday: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
				tuesday: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
				wednesday: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
				thursday: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
				friday: ['09:00', '10:00', '11:00', '12:00', '13:00']
			}
		}
	]
};

export const BOOKING_CONFIG_KEY = 'ssbv1-booking-config';
