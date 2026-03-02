const app = require("./src/app");

const port = process.env.PORT || 3003;

app.listen(port, () => {
  console.log(`Tasks Kanban running on port ${port}`);
});
