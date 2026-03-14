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

		const self = this;
		fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				sorts: [{ property: "Week Of", direction: "descending" }],
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
				if (!data || !data.results || !data.results.length) {
					console.error("[MMM-SchoolLunch] No results from Notion");
					return;
				}

				const page = data.results[0];
				const props = page.properties;

				self.lunchData = {
					weekOf: self.getTitle(props["Week Of"]),
					days: {
						Monday: self.getRichText(props["Monday"]),
						Tuesday: self.getRichText(props["Tuesday"]),
						Wednesday: self.getRichText(props["Wednesday"]),
						Thursday: self.getRichText(props["Thursday"]),
						Friday: self.getRichText(props["Friday"]),
					},
				};

				console.log(`[MMM-SchoolLunch] Loaded week of ${self.lunchData.weekOf}`);
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
