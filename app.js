const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 8080;


const mongodbUrl = "mongodb+srv://ikennaidigo:VWDksZCI6dVMAJtp@lunchcluster.jvg2fmg.mongodb.net/?retryWrites=true&w=majority&appName=lunchcluster";
mongoose.connect(mongodbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// Define Eatery schema and model
const EaterySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
});

const Eatery = mongoose.model('Eatery', EaterySchema);

// Define Votesession schema and model
const VotesessionSchema = new mongoose.Schema({
  user: String,
  votes: String,
  category: Number,
});

const Votesession = mongoose.model('Votesession', VotesessionSchema);

// Middleware for parsing request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/eateries', async (req, res) => {
  try {
    const existingEateries = await Eatery.find().sort({ name: 1 });;
    res.status(200).json(existingEateries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add bulk eateries (only if they don't exist)
app.post('/eateries/bulk', async (req, res) => {
  try {
    const eateryNames = req.body.eateries;
    const existingEateries = await Eatery.find({ name: { $in: eateryNames } });
    const existingEateryNames = existingEateries.map((eatery) => eatery.name);
    const newEateryNames = eateryNames.filter(
      (name) => !existingEateryNames.includes(name)
    );

    const newEateries = await Eatery.insertMany(
      newEateryNames.map((name) => ({ name }))
    );

    res.status(200).json(newEateries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete bulk eateries
app.delete('/eateries/bulk', async (req, res) => {
  try {
    const eateryNames = req.body.eateries;
    const deletedCount = await Eatery.deleteMany({ name: { $in: eateryNames } });

    res.status(200).json({ deletedCount: deletedCount.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/votesessions', async (req, res) => {
  try {
    const { user, votes } = req.body;

    const maxCategory = await Votesession.aggregate([
        { $group: { _id: null, maxCategory: { $max: "$category" } } }
      ])
      .then(result => result.length > 0 ? result[0].maxCategory : 1);

    const sessions = await Votesession.find({ category: maxCategory });

    let newSession;
    if (sessions.length === 0) {
      newSession = await Votesession.create({ user, votes, category: maxCategory });
    } else if (sessions.length === 1) {
      if (sessions[0].user !== user) {
        newSession = await Votesession.create({ user, votes, category: maxCategory });
      } else {
        newSession = sessions[0];
      }
    } else if (sessions.length === 2) {
      newSession = await Votesession.create({ user, votes, category: maxCategory + 1 });
    }

    res.status(200).json(newSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/votesessions/:id?', async (req, res) => {
  try {
    const id = req.params.id;
    let maxCategory = await Votesession.aggregate([
        { $group: { _id: null, maxCategory: { $max: "$category" } } }
      ])
      .then(result => result.length > 0 ? result[0].maxCategory : 0);

    if (maxCategory === 0) {
      return res.status(404).json({ error: "Not Found" });
    }

    if (id) {
      if (maxCategory === 1) {
        return res.status(404).json({ error: "Not Found" });
      } else {
        maxCategory -= 1;
      }
    }

    const voteSessions = await Votesession.find({ category: maxCategory });

    const users = voteSessions.map((session) => session.user);

    const allVotes = voteSessions.flatMap((session) => session.votes.split(','));

    // if(allVotes.length)

    const scoredVotes = voteSessions.flatMap((session) => {
      const votes = session.votes.split(',');
      return votes.map((vote, index) => ({
        vote,
        score: votes.length - index,
      }));
    });

    const voteCounts = scoredVotes.reduce((counts, { vote, score }) => {
      if(counts[vote]){
        counts[vote] += (score+5);
      }else{
        counts[vote] = score;
      }
      // counts[vote] = (counts[vote] || 0) + score;
      return counts;
    }, {});

    const sortedVoteCounts = Object.entries(voteCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([vote, score]) => `${vote}: ${score}`);

    res.status(200).json({ users, votes: sortedVoteCounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});