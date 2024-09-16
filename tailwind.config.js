/** @type {import('tailwindcss').Config} */
export default {
	content: ["*.html", "./src/js/*.js"],
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Roboto"'],
			},
		},
	},
	plugins: [],
};
