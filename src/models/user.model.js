import mongoose , {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";



const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true // for search in optimized way
    },
    email : {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    avatar: {
        type: String, //cloudinary url jaha aws pe files upload krte wo irl dedeta
        required: true,
    },
    coverImage: {
        type: String, //cloudinary url jaha aws pe files upload krte wo irl dedeta
    },
    watchHistory: {
        type: Schema.Types.ObjectId,
        ref: "Video"
    },
    password: {
        type: String,
        required: [true,'Password is required']
    },
    refreshToken: {
        type: String
    }

}, {timestamps: true});

userSchema.pre("save", async function(next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function 
(password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
        _id: this._id,
        email: this.email,
        fullName: this.fullName,
        username: this.username
        },
        process.env.JWT_ACCESS_SECRET,
        {expiresIn: process.env.JWT_ACCESS_LIFETIME}
    )
}

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
        _id: this._id,
        },
        process.env.JWT_REFRESH_SECRET,
        {expiresIn: process.env.JWT_REFRESH_LIFETIME}
    )
}

export const User = mongoose.model("User", userSchema)