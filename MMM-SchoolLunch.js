Module.register("MMM-SchoolLunch", {
	defaults: {
		animationSpeed: 1000,
	},

	start() {
		this.lunchData = null;
		this.sendSocketNotification("GET_LUNCH");
		this.scheduleRefresh();
	},

	scheduleRefresh() {
		setInterval(() => {
			this.sendSocketNotification("GET_LUNCH");
		}, 15 * 60 * 1000);
	},

	socketNotificationReceived(notification, payload) {
		if (notification === "LUNCH_DATA") {
			this.lunchData = payload;
			this.updateDom(this.config.animationSpeed);
		}
	},

	getDom() {
		const wrapper = document.createElement("div");
		wrapper.className = "school-lunch";

		const now = new Date();
		const dayIndex = now.getDay(); // 0=Sun, 6=Sat

		if (!this.lunchData) {
			wrapper.className += " dimmed light small";
			wrapper.textContent = "No lunch data loaded yet.";
			return wrapper;
		}

		const isWeekend = dayIndex === 0 || dayIndex === 6;

		const header = document.createElement("div");
		header.className = "school-lunch-header";
		header.textContent = "School Lunch";
		wrapper.appendChild(header);

		const week = document.createElement("div");
		week.className = "school-lunch-week";
		week.textContent = isWeekend
			? `Next week \u2014 ${this.formatWeekOf(this.lunchData.weekOf)}`
			: `Week of ${this.formatWeekOf(this.lunchData.weekOf)}`;
		wrapper.appendChild(week);

		const hr = document.createElement("hr");
		hr.className = "school-lunch-divider";
		wrapper.appendChild(hr);

		const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
		const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

		for (const day of dayNames) {
			if (!isWeekend && dayMap[day] < dayIndex) continue; // skip past days on weekdays

			const dish = this.lunchData.days[day];
			const isToday = !isWeekend && dayMap[day] === dayIndex;
			const isBringLunch = !dish || dish.trim() === "";

			const row = document.createElement("div");
			row.className = "school-lunch-row";
			if (isToday) row.classList.add("today");

			const dayLabel = document.createElement("span");
			dayLabel.className = "day-name";
			dayLabel.textContent = isToday ? "Today" : day;
			row.appendChild(dayLabel);

			const dishLabel = document.createElement("span");
			if (isBringLunch) {
				dishLabel.className = "dish bring-lunch";
				dishLabel.textContent = "Bring lunch";
			} else {
				dishLabel.className = "dish";
				dishLabel.textContent = dish;
			}
			row.appendChild(dishLabel);

			wrapper.appendChild(row);
		}

		return wrapper;
	},

	formatWeekOf(dateStr) {
		if (!dateStr) return "";
		const d = new Date(dateStr + "T00:00:00");
		return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
	},

	getStyles() {
		return ["MMM-SchoolLunch.css"];
	},
});
