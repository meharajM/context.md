package com.meharaj.contextengine

import android.app.job.JobInfo
import android.content.ComponentName
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@SdkSuppress(minSdkVersion = 34)
class UserInitiatedModelDownloadJobServiceInstrumentedTest {
    @Test
    fun modelDownloadJobIsUserInitiatedAndNetworkConstrained() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val job = UserInitiatedModelDownloadJobs.buildJobInfo(
            context,
            modelId = "gemma4-e2b-it",
            downloadWhisperModel = false,
            estimatedBytes = 2_588_147_712L,
        )

        assertTrue(job.isUserInitiated)
        assertEquals(JobInfo.NETWORK_TYPE_ANY, job.networkType)
        assertEquals(ComponentName(context, UserInitiatedModelDownloadJobService::class.java), job.service)
        assertEquals("gemma4-e2b-it", job.extras.getString(UserInitiatedModelDownloadJobs.EXTRA_MODEL_ID))
    }
}
