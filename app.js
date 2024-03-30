const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, Model, DataTypes } = require('sequelize');

const app = express();
const port = process.env.PORT || 8080;

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db.sqlite'
});

// Define User model
// class User extends Model {}
// User.init({
//   name: DataTypes.STRING,
//   id: {
//     type:DataTypes.STRING
//   },
//   password: DataTypes.STRING
// }, { sequelize, modelName: 'user' });

class Eatery extends Model {}
Eatery.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
}, { sequelize, modelName: 'eatery' });

class Votesession extends Model {}
Votesession.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user: DataTypes.STRING,
      votes: DataTypes.STRING,
      category: DataTypes.INTEGER,

}, { sequelize, modelName: 'votesession' });


// Sync models with database
sequelize.sync();

// Middleware for parsing request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// CRUD routes for User model
// app.get('/users', async (req, res) => {
//   const users = await User.findAll();
//   res.json(users);
// });

// app.get('/users/:id', async (req, res) => {
//   const user = await User.findByPk(req.params.id);
//   res.json(user);
// });

// app.post('/users', async (req, res) => {
//   const user = await User.create(req.body);
//   res.json(user);
// });

// app.put('/users/:id', async (req, res) => {
//   const user = await User.findByPk(req.params.id);
//   if (user) {
//     await user.update(req.body);
//     res.json(user);
//   } else {
//     res.status(404).json({ message: 'User not found' });
//   }
// });

// app.delete('/users/:id', async (req, res) => {
//   const user = await User.findByPk(req.params.id);
//   if (user) {
//     await user.destroy();
//     res.json({ message: 'User deleted' });
//   } else {
//     res.status(404).json({ message: 'User not found' });
//   }
// });

// Add bulk eateries (only if they don't exist)
app.post('/eateries/bulk', async (req, res) => {
    try {
      const eateryNames = req.body.eateryNames;
      const existingEateries = await Eatery.findAll({
        where: {
          name: eateryNames,
        },
      });
  
      const existingEateryNames = existingEateries.map((eatery) => eatery.name);
      const newEateryNames = eateryNames.filter(
        (name) => !existingEateryNames.includes(name)
      );
  
      const newEateries = await Eatery.bulkCreate(
        newEateryNames.map((name) => ({ name }))
      );
  
      res.status(200).json({ newEateries });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bulk eateries
app.delete('/eateries/bulk', async (req, res) => {
    try {
      const eateryNames = req.body.eateryNames;
      const deletedCount = await Eatery.destroy({
        where: {
          name: eateryNames,
        },
      });
  
      res.status(200).json({ deletedCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/votesessions', async (req, res) => {
    try {
      const { user, votes } = req.body;

      let maxCategory = await Votesession.max('category');

      if(maxCategory == null){
        maxCategory = 1;
      }

      const sessions = await Votesession.findAll({
          where:{
            category: maxCategory
          }
      });

      let newSession;
      if (sessions.length == 0){
        newSession = await Votesession.create({ user,votes,category:maxCategory });
      }else if(sessions.length == 1){
        if(sessions[0].user != user){
            newSession = await Votesession.create({ user,votes,category:maxCategory });
        }else{
            newSession = sessions[0];
        }
      }else if(sessions.length == 2){
        maxCategory += 1;
        newSession = await Votesession.create({ user,votes,category:maxCategory });
      }
  
      res.status(200).json({ newSession });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/votesessions/:id?', async (req, res) => {
    try {
        let id = req.params.id;
      let maxCategory = await Votesession.max('category');

      if(maxCategory == null){
        return res.status(404).json({error: "Not Found"});
      }

      if(id){
        if(maxCategory-1 == 0){
            return res.status(404).json({error: "Not Found"});
        }else{
            maxCategory -= 1;
        }
      }


      const voteSessions = await Votesession.findAll({
        where: {
          category: maxCategory
        },
        attributes: ['votes']
      });
      
      const scoredVotes = voteSessions.flatMap(session => {
        const votes = session.votes.split(',');
        return votes.map((vote, index) => ({
          vote,
          score: votes.length - index
        }));
      });
      
      const voteCounts = scoredVotes.reduce((counts, { vote, score }) => {
        counts[vote] = (counts[vote] || 0) + score;
        return counts;
      }, {});
      
      const sortedVoteCounts = Object.entries(voteCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([vote, score]) => `${vote}: ${score}`);
      
      console.log(sortedVoteCounts);
      res.status(200).json({ sortedVoteCounts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});