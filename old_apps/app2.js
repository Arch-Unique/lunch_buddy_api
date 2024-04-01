const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 8080;

const CyclicDb = require("@cyclic.sh/dynamodb")
const db = CyclicDb("worried-overalls-foxCyclicDB")

const eateries = db.collection("eateries");
const votesession = db.collection("votesession");

// Middleware for parsing request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/eateries', async (req, res) => {
  try {
    const {results} = await eateries.list();

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Add bulk eateries (only if they don't exist)
app.post('/eateries/bulk', async (req, res) => {
    try {
      const eateryNames = req.body.eateries;

      const existingEateries = [];

    for (const name of eateryNames) {
      const { results } = await eateries.filter({ name });
      existingEateries.push(...results);
    }

    const existingEateryNames = existingEateries.map(eatery => eatery.props.name);
    const newEateryNames = eateryNames.filter(name => !existingEateryNames.includes(name));
    const newEateries = await Promise.all(newEateryNames.map(async name => {
      const eatery = eateries.item(name);
      await eatery.set({ name });
      return eatery.get();
    }));
  
      res.status(200).json(newEateries);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bulk eateries
app.delete('/eateries/bulk', async (req, res) => {
    try {
      const eateryNames = req.body.eateries;
      const deletedCount = await Promise.all(eateryNames.map(async name => {
        const eatery = eateries.item(name);
        await eatery.delete();
      }));
  
      res.status(200).json({ deletedCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/votesessions', async (req, res) => {
    try {
      const { user, votes } = req.body;

      const maxCategory = await votesession.latest()?.props?.category || 1;
    const sessions = await votesession.filter({ category: maxCategory });
    let newSession;
    if (sessions.results.length === 0) {
      newSession = await votesession.item(`session-${maxCategory}`).set({ user, votes, category: maxCategory });
    } else if (sessions.results.length === 1) {
      const [existingSession] = sessions.results;
      console.log(existingSession);
      if (existingSession.props.user !== user) {
        newSession = await votesession.item(`session-${maxCategory + 1}`).set({ user, votes, category: maxCategory});
      } else {
        newSession = existingSession;
      }
    } else if (sessions.results.length === 2) {
      newSession = await votesession.item(`session-${maxCategory + 1}`).set({ user, votes, category: maxCategory});
    }
  
      res.status(200).json(newSession);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/votesessions/:id?', async (req, res) => {
    try {
        let id = req.params.id;
        let fr = await votesession.list();
        console.log(fr.results);
        let maxCategory = await votesession.latest()?.props?.category || 0;
        console.log(maxCategory);
        if (maxCategory === 0) {
          return res.status(404).json({ error: 'Not Found' });
        }
        if (id) {
          if (maxCategory === 1) {
            return res.status(404).json({ error: 'Not Found' });
          } else {
            maxCategory -= 1;
          }
        }
        const sessions = await votesession.filter({ category: maxCategory });
        const users = sessions.results.map(session => session.props.user);
        const scoredVotes = sessions.results.flatMap(session => {
          const votes = session.props.votes.split(',');
          return votes.map((vote, index) => ({ vote, score: votes.length - index }));
        });
        const voteCounts = scoredVotes.reduce((counts, { vote, score }) => {
          counts[vote] = (counts[vote] || 0) + score;
          return counts;
        }, {});
        const sortedVoteCounts = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([vote, score]) => `${vote}: ${score}`);
      
      console.log(sortedVoteCounts);
      res.status(200).json({users, votes: sortedVoteCounts});
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});