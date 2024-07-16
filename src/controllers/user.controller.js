import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";



const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new apiError(500, "Something went wrong while generating access and refresh token")
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    // req body se data le ao
    // username email wagera hai ya nai
    // find the user
    // check password
    // generate access and refresh token
    // send cookie

    const { email,username, password } = req.body;
    console.log(email)

    if (!username && !email) {
        throw new apiError(400, "Username or passwords required");
        
    }

    const user = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    })

    if (!user) {
        throw new apiError(404, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new apiError(400, "Incorrect password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure: true}

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new apiResponse(200,
        {
            user: loggedInUser,
            accessToken,
            refreshToken
        },
        "User logged in successfully"
    ))

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findOneAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }


    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
        throw new apiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, newrefreshToken } = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new apiResponse(200, {accessToken, refreshToken: newrefreshToken}, "Access token refreshed successfully"))
    
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
}) 

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(400, "Old password is incorrect")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })
    return res.status(200).json(new apiResponse(200, {}, "Password changed successfully"))

});

//need to take current user 

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new apiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDeatils = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if(!fullName || !email) {
        throw new apiError(400, "All fields are required")
    }

    //now find user and update

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
        
    ).select("-password")

    return res.status(200).json(new apiResponse(200, user, "Account details updated successfully"))
})

//now to update files


//need to del old image
const updateProfilePicture = asyncHandler(async (req, res) => 
{
    const avatarLocalPath = req.file?.path 

    if(!avatarLocalPath) {
        throw new apiError(400, "Profile picture is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
    if (!avatar.url) {
        throw new apiError(400, "Something went wrong while uploading profile picture")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar: avatar.url
        }
    }, {
        new: true
    }.select("-password"))

    return res.status(200).json(new apiResponse(200, user, "Profile picture updated successfully"))

})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new apiError(400, "Cover image is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new apiError(400, "Something went wrong while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, {
        new: true
    }.select("-password"))

    return res.status(200).json(new apiResponse(200, user, "Cover image updated successfully"))

})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new apiError(400, "Username is required")
    }
    
    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                        }
                    }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if(!channel?.length) {
        throw new apiError(404, "Channel not found")
    }

    return res.status(200).json(new apiResponse(200, channel[0], "Channel profile fetched successfully"))
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDeatils, updateProfilePicture, updateCoverImage, getUserChannelProfile }  