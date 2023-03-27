const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializerDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Start at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};

initializerDbAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  const hashedPassword = await bcrypt.hash(password, 10);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "ravalicdr");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationWithToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ravalicdr", async (error, payload) => {
      if (error) {
        response.send("Invalid access token");
      } else {
        next();
      }
    });
  }
};

const convertStateObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

convertStatsObjectToResponseObject = (dbObject) => {
  return {
    totalCases: dbObject["SUM(cases)"],
    totalCured: dbObject["SUM(cured)"],
    totalActive: dbObject["SUM(active)"],
    totalDeaths: dbObject["SUM(deaths)"],
  };
};

app.get("/states/", authenticationWithToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const allStates = await db.all(getStatesQuery);
  response.send(
    allStates.map((eachStates) =>
      convertStateObjectToResponseObject(eachStates)
    )
  );
});

app.get(
  "/states/:stateId",
  authenticationWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
    const states = await db.get(getStateQuery);
    response.send(convertStateObjectToResponseObject(states));
  }
);

app.post("/districts/", authenticationWithToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const districtQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths});`;
  await db.run(districtQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};`;
    const getDistrict = await db.get(districtQuery);
    response.send(convertDistrictObjectToResponseObject(getDistrict));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE From district WHERE district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationWithToken,
  async (request, response) => {
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const { districtId } = request.params;
    const updateQuery = `
    UPDATE district SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} WHERE district_id = ${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
    SELECT SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths) FROM district WHERE state_id = ${stateId}; `;
    const statistics = await db.get(statsQuery);
    response.send(convertStatsObjectToResponseObject(statistics));
  }
);

module.exports = app;
