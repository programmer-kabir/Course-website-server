const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middle ware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized token" });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized token" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0i3pjbq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("Development").collection("users");
    const courses = client.db("Development").collection("Course");
    const BookMark = client.db("Development").collection("book");
    const PaymentCollection = client.db("Development").collection("payment");

    // jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token =  jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({token});
    });

    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      if(user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      next()
    }

    // User apis

    app.get("/users",verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Admin Route

    app.get('/users/admin/:email', verifyJWT, async(req, res)=>{
      const email = req. params.email

      if(req.decoded.email !== email){
        res.send({admin:false})
      }
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      const result = {admin:user?.role  === 'admin'}
      res.send(result)
    })

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    // Instructor Route

    app.get('/users/instructor/:email', verifyJWT, async(req, res)=>{
      const email = req. params.email

      if(req.decoded.email !== email){
        res.send({instructor:false})
      }
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      const result = {instructor:user?.role  === 'instructor'}
      res.send(result)
    })

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    

    // select apis
    app.post("/book", async (req, res) => {
      const data = req.body;
      const result = await BookMark.insertOne(data);
      // console.log(result);
      res.send(result);
    });

    app.get("/book",verifyJWT, async (req, res) => {
      const email = req.query.email;
      if(!email){
        res.send([])
      }
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return  res.status(403).send({error:true, message:'forbidden access'})
      }
      const query = { email: email };
      const result = await BookMark.find(query).toArray();
      res.send(result);
    });

    // Course Apis
    app.get("/course", async (req, res) => {
      const user = req.body;
      const result = await courses.find(user).toArray();
      res.send(result);
    });


    // payment
    app.post('/create-payment-intent', async(req, res) =>{
      const {price} = req.body
      const amount = price*100;
      console.log(price);
      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // app.post('/payments',verifyJWT, async(req, res) =>{
    //   const payment = req.body
    //   const result = await PaymentCollection.insertOne(payment)

    //   // const query = { _id: { $in: payment.BookItems.map(id => new ObjectId(id)) } }
    //   // const deleteResult = await BookMark.deleteMany(query)
    //   res.send({result, deleteResult})
    // })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sever is running");
});
app.listen(port);
