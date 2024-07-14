import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    //get userdetails from frontend
    //need to put validation
    //check if user already exist
    //check from images,avatar
    //upload them to cloudinary and save url
    //create user obj - entry in db
    //remove pass and refresh token field from response
    //check for user creation
    //return response

    const { fullName, email, username, password } = req.body;
    console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new apiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({ 
        $or: [
            { username },
            { email }
        ]
    })

    if (existedUser) {
        throw new apiError(409, "User already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files?.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new apiError(400, "Avatar upload failed");
    }

    const user = await User.create({ 
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
        
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
        )

    if (!createdUser) {
        throw new apiError(400, "User creation failed");
    }

    res.status(201).json(
        new apiResponse(200, createdUser, "User created successfully")
    )

}); 

export { registerUser }