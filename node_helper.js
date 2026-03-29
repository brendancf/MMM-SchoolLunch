const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
	start() {
		this.configPath = path.join(
			process.env.HOME,
			".config",
			"magicmirror",
			"notion.json",
		);
		this.lunchData = null;
		this.startPolling();
	},

	startPolling() {
		setInterval(() => this.fetchLunch(), 5 * 60 * 1000);
	},

	loadConfig() {
		const raw = fs.readFileSync(this.configPath, "utf8");
		return JSON.parse(raw);
	},

	getTitle(property) {
		if (!property || !property.title || !property.title.length) return "";
		return property.title.map((t) => t.plain_text).join("");
	},

	getRichText(property) {
		if (!property || !property.rich_text || !property.rich_text.length)
			return "";
		return property.rich_text.map((t) => t.plain_text).join("");
	},

	/**
	 * Get the Monday ISO date (YYYY-MM-DD) for the current week.
	 * On weekends, returns next week's Monday so the display looks ahead.
	 */
	getCurrentMonday() {
		const now = new Date();
		const day = now.getDay(); // 0=Sun, 6=Sat
		const diff = day === 0 ? 1 : day === 6 ? 2 : -(day - 1);
		const monday = new Date(now);
		monday.setDate(now.getDate() + diff);
		return monday.toISOString().split("T")[0];
	},

	fetchLunch() {
		console.log("[MMM-SchoolLunch] Fetching lunch data from Notion...");
		let config;
		try {
			config = this.loadConfig();
		} catch (e) {
			console.error(`[MMM-SchoolLunch] Error reading config: ${e.message}`);
			return;
		}

		const dbId = config.school_lunch_database_id;
		const token = config.token;

		if (!dbId || !token) {
			console.error("[MMM-SchoolLunch] Missing token or database ID in notion.json");
			return;
		}

		const targetMonday = this.getCurrentMonday();

		const self = this;
		fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				filter: {
					property: "Week Of",
					title: { equals: targetMonday },
				},
				page_size: 1,
			}),
		})
			.then((response) => {
				if (!response.ok) {
					console.error(`[MMM-SchoolLunch] Notion API error: ${response.status}`);
					return null;
				}
				return response.json();
			})
			.then((data) => {
				if (!data) return;

				if (!data.results || !data.results.length) {
					console.log(`[MMM-SchoolLunch] No page found for week of ${targetMonday}`);
					self.lunchData = {
						weekOf: targetMonday,
						ordered: false,
						days: {
							Monday: "",
							Tuesday: "",
							Wednesday: "",
							Thursday: "",
							Friday: "",
						},
					};
					self.sendSocketNotification("LUNCH_DATA", self.lunchData);
					return;
				}

				const page = data.results[0];
				const props = page.properties;
				const days = {
					Monday: self.getRichText(props["Monday"]),
					Tuesday: self.getRichText(props["Tuesday"]),
					Wednesday: self.getRichText(props["Wednesday"]),
					Thursday: self.getRichText(props["Thursday"]),
					Friday: self.getRichText(props["Friday"]),
				};
				const ordered = Object.values(days).some((v) => v && v.trim() !== "");

				self.lunchData = {
					weekOf: self.getTitle(props["Week Of"]) || targetMonday,
					ordered,
					days,
				};

				console.log(`[MMM-SchoolLunch] Loaded week of ${self.lunchData.weekOf} (ordered: ${ordered})`);
				self.sendSocketNotification("LUNCH_DATA", self.lunchData);
			})
			.catch((e) => {
				console.error(`[MMM-SchoolLunch] Error fetching lunch data: ${e.message}`);
			});
	},

	socketNotificationReceived(notification) {
		if (notification === "GET_LUNCH") {
			if (this.lunchData) {
				this.sendSocketNotification("LUNCH_DATA", this.lunchData);
			}
			this.fetchLunch();
		}
	},
});
